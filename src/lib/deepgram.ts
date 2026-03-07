// Deepgram STT Client
// Real-time speech-to-text using Deepgram WebSocket API
// Uses raw PCM linear16 via Web Audio API for maximum reliability.
// API key fetched from /api/auth/deepgram-token (rate-limited server endpoint)

import { API_ROUTES } from '@/lib/api-routes';

export interface DeepgramTranscript {
    text: string;
    isFinal: boolean;
    confidence: number;
}

export type DeepgramState = 'idle' | 'fetching-token' | 'mic-request' | 'connecting' | 'connected' | 'recording' | 'error' | 'closed';

export interface DeepgramSTTOptions {
    onTranscript: (transcript: DeepgramTranscript) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    onStateChange?: (state: DeepgramState) => void;
    language?: string;
    apiKey?: string;
    agentId?: string;
    stream?: MediaStream; // Pre-acquired mic stream (avoids user-gesture requirement)
}

export class DeepgramSTT {
    private socket: WebSocket | null = null;
    private stream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private options: DeepgramSTTOptions;
    private apiKey: string | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private lastMessageTime: number = Date.now();
    private shouldReconnect: boolean = true;

    // Transcript accumulation
    private accumulatedText: string = '';

    constructor(options: DeepgramSTTOptions) {
        this.options = options;
        this.apiKey = options.apiKey || null;
    }

    private setState(state: DeepgramState): void {
        this.options.onStateChange?.(state);
    }

    async start(): Promise<void> {
        if (!this.apiKey) {
            this.setState('fetching-token');
            try {
                console.log(`[Deepgram] 🔑 Fetching ${API_ROUTES.deepgramToken}...`);
                const res = await fetch(API_ROUTES.deepgramToken, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: this.options.agentId }),
                });
                if (!res.ok) {
                    const errBody = await res.text().catch(() => '');
                    console.error('[Deepgram] Token fetch failed:', res.status, errBody);
                    this.setState('error');
                    throw new Error(`Deepgram token failed (${res.status}): ${errBody}`);
                }
                const data = await res.json();
                this.apiKey = data.token;
                console.log('[Deepgram] Token acquired');
            } catch (err) {
                this.setState('error');
                throw err instanceof Error ? err : new Error('Failed to get Deepgram token from server');
            }
        }

        if (!this.apiKey) {
            this.setState('error');
            throw new Error('Deepgram token not available');
        }

        // Get microphone access — use pre-acquired stream if available (preserves user gesture)
        this.setState('mic-request');
        if (this.options.stream) {
            this.stream = this.options.stream;
            console.log('[Deepgram] Using pre-acquired microphone stream');
        } else {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
                console.log('[Deepgram] Microphone access granted');
            } catch (micErr) {
                console.error('[Deepgram] Microphone access denied:', micErr);
                this.setState('error');
                throw new Error('Microphone access denied. Please allow microphone permission.');
            }
        }

        // Log mic stream track state for debugging
        const tracks = this.stream.getAudioTracks();
        console.log('[Deepgram] Mic tracks:', tracks.map(t => ({
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
        })));

        this.accumulatedText = '';

        // Connect to Deepgram WebSocket with explicit linear16 encoding
        // We send raw PCM int16 at 16kHz mono via Web Audio API — most reliable approach
        const deepgramModel = process.env.NEXT_PUBLIC_DEEPGRAM_MODEL || 'nova-2';
        const wsUrl = `wss://api.deepgram.com/v1/listen?` +
            `model=${deepgramModel}&` +
            `language=${this.options.language || 'en-US'}&` +
            `encoding=linear16&` +
            `sample_rate=16000&` +
            `channels=1&` +
            `punctuate=true&` +
            `interim_results=true&` +
            `endpointing=300&` +
            `utterance_end_ms=1000&` +
            `vad_events=true&` +
            `smart_format=true`;

        this.setState('connecting');
        console.log('[Deepgram] Connecting to:', wsUrl);

        // Await WebSocket open before returning
        await new Promise<void>((resolve, reject) => {
            this.socket = new WebSocket(wsUrl, ['token', this.apiKey!]);

            const connectTimeout = setTimeout(() => {
                console.error('[Deepgram] WebSocket connection timeout (10s)');
                this.socket?.close();
                this.setState('error');
                reject(new Error('Deepgram WebSocket connection timeout'));
            }, 10000);

            this.socket.onopen = () => {
                clearTimeout(connectTimeout);
                console.log('[Deepgram] Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.lastMessageTime = Date.now();
                this.setState('connected');
                this.startRecording();
                this.startHeartbeat();
                resolve();
            };

            this.socket.onmessage = (event) => {
                this.lastMessageTime = Date.now();

                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'Results') {
                        const alt = data.channel?.alternatives?.[0];
                        const text = alt?.transcript || '';
                        console.log('[Deepgram] Result:', {
                            text: text || '(empty)',
                            is_final: data.is_final,
                            speech_final: data.speech_final,
                            confidence: alt?.confidence,
                        });

                        if (!alt) return;

                        if (data.is_final && text) {
                            this.accumulatedText += (this.accumulatedText ? ' ' : '') + text;
                            console.log('[Deepgram] ✅ Final segment:', text, '| Accumulated:', this.accumulatedText);
                        }

                        if (data.speech_final && this.accumulatedText.trim()) {
                            console.log('[Deepgram] 🎤 Speech final — dispatching:', this.accumulatedText);
                            this.options.onTranscript({
                                text: this.accumulatedText.trim(),
                                isFinal: true,
                                confidence: alt.confidence || 0,
                            });
                            this.accumulatedText = '';
                        } else if (!data.is_final && text) {
                            const preview = this.accumulatedText
                                ? this.accumulatedText + ' ' + text
                                : text;
                            this.options.onTranscript({
                                text: preview,
                                isFinal: false,
                                confidence: alt.confidence || 0,
                            });
                        }
                    } else if (data.type === 'UtteranceEnd') {
                        console.log('[Deepgram] UtteranceEnd — accumulated:', this.accumulatedText || '(empty)');
                        if (this.accumulatedText.trim()) {
                            console.log('[Deepgram] 🎤 UtteranceEnd — dispatching:', this.accumulatedText);
                            this.options.onTranscript({
                                text: this.accumulatedText.trim(),
                                isFinal: true,
                                confidence: 1,
                            });
                            this.accumulatedText = '';
                        }
                    } else {
                        console.log('[Deepgram] Event:', data.type, data);
                    }

                } catch (err) {
                    console.error('[Deepgram] Parse error:', err);
                }
            };

            this.socket.onerror = (event) => {
                clearTimeout(connectTimeout);
                console.error('[Deepgram] WebSocket error:', event);
                this.setState('error');
                this.options.onError?.(new Error('Deepgram connection error'));
                reject(new Error('Deepgram connection error'));
            };

            this.socket.onclose = (event) => {
                console.log('[Deepgram] Disconnected — code:', event.code, 'reason:', event.reason);
                this.isConnected = false;
                this.setState('closed');
                this.stopHeartbeat();

                if (this.accumulatedText.trim()) {
                    this.options.onTranscript({
                        text: this.accumulatedText.trim(),
                        isFinal: true,
                        confidence: 1,
                    });
                    this.accumulatedText = '';
                }

                if (this.shouldReconnect && this.stream) {
                    this.reconnect();
                } else {
                    this.options.onClose?.();
                }
            };
        });
    }

    private async startRecording(): Promise<void> {
        if (!this.stream || !this.socket) return;

        // Use Web Audio API to capture raw PCM linear16.
        // IMPORTANT: Use the browser's default sample rate (usually 48kHz) to avoid
        // the zero-audio bug where AudioContext({ sampleRate: 16000 }) + createMediaStreamSource
        // produces silence on some browsers due to sample rate mismatch.
        // We downsample to 16kHz ourselves before sending to Deepgram.
        try {
            this.audioContext = new AudioContext(); // Use browser default (48kHz)
            const nativeSampleRate = this.audioContext.sampleRate;
            const targetSampleRate = 16000;
            const downsampleRatio = nativeSampleRate / targetSampleRate;
            console.log('[Deepgram] AudioContext sampleRate:', nativeSampleRate, '→ downsample to', targetSampleRate, `(ratio: ${downsampleRatio.toFixed(2)}), state:`, this.audioContext.state);

            // CRITICAL: AudioContext may start suspended if no user gesture is active.
            // Must resume it or onaudioprocess won't fire.
            if (this.audioContext.state === 'suspended') {
                console.log('[Deepgram] AudioContext suspended — resuming...');
                await this.audioContext.resume();
                console.log('[Deepgram] AudioContext resumed, state:', this.audioContext.state);
            }
            this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

            // ScriptProcessorNode with 4096 buffer, 1 input channel, 1 output channel
            this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

            let chunkCount = 0;
            let peakLevel = 0;

            this.processorNode.onaudioprocess = (e) => {
                if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

                const float32 = e.inputBuffer.getChannelData(0);

                // Track peak level from native audio (before downsample)
                for (let i = 0; i < float32.length; i++) {
                    const abs = Math.abs(float32[i]);
                    if (abs > peakLevel) peakLevel = abs;
                }

                // Downsample from native rate (e.g. 48kHz) to 16kHz
                const downsampledLength = Math.floor(float32.length / downsampleRatio);
                const int16 = new Int16Array(downsampledLength);
                for (let i = 0; i < downsampledLength; i++) {
                    // Pick the nearest sample from the source
                    const srcIndex = Math.floor(i * downsampleRatio);
                    const s = Math.max(-1, Math.min(1, float32[srcIndex]));
                    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                this.socket.send(int16.buffer);
                chunkCount++;

                // Log first 5 chunks and every 20th after that, include audio level
                if (chunkCount <= 5 || chunkCount % 20 === 0) {
                    console.log(`[Deepgram] Sent PCM chunk #${chunkCount} (${int16.buffer.byteLength} bytes, peak: ${peakLevel.toFixed(4)})`);
                    peakLevel = 0;
                }
            };

            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);

            this.setState('recording');
            console.log(`[Deepgram] Recording started (linear16, ${targetSampleRate}Hz, mono via Web Audio API, native: ${nativeSampleRate}Hz)`);
        } catch (err) {
            console.error('[Deepgram] Failed to start Web Audio recording:', err);
            this.setState('error');
            this.options.onError?.(new Error('Failed to start audio recording'));
        }
    }

    private reconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Deepgram] Max reconnection attempts reached');
            this.options.onError?.(new Error('Failed to reconnect to Deepgram'));
            this.options.onClose?.();
            return;
        }

        this.reconnectAttempts++;
        const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[Deepgram] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        this.reconnectTimer = setTimeout(() => {
            this.start().catch(err => {
                console.error('[Deepgram] Reconnection failed:', err);
            });
        }, delay);
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (Date.now() - this.lastMessageTime > 60000) {
                console.warn('[Deepgram] Connection stale, reconnecting...');
                this.socket?.close();
            }
        }, 30000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    stop(): void {
        console.log('[Deepgram] Stopping...');
        this.shouldReconnect = false;
        this.setState('closed');

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopHeartbeat();

        // Clean up Web Audio nodes
        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }

        if (this.stream) {
            // Always stop tracks — if caller passed a clone, stopping it won't affect original
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.stream = null;

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'CloseStream' }));
            this.socket.close();
        }
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.accumulatedText = '';
    }

    get connected(): boolean {
        return this.isConnected;
    }
}

export function isDeepgramConfigured(): boolean {
    return true;
}
