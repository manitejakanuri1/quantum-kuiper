// Deepgram STT Client
// Real-time speech-to-text using Deepgram WebSocket API
// Uses API key fetched from /api/auth/deepgram-token (rate-limited server endpoint)

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
    private mediaRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private options: DeepgramSTTOptions;
    private apiKey: string | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
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
                const res = await fetch('/api/auth/deepgram-token', {
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
                        echoCancellation: false,
                        noiseSuppression: true,
                    }
                });
                console.log('[Deepgram] Microphone access granted');
            } catch (micErr) {
                console.error('[Deepgram] Microphone access denied:', micErr);
                this.setState('error');
                throw new Error('Microphone access denied. Please allow microphone permission.');
            }
        }

        this.accumulatedText = '';

        // Connect to Deepgram WebSocket
        // MUST specify encoding/container/sample_rate to match MediaRecorder's WebM/Opus output
        const deepgramModel = process.env.NEXT_PUBLIC_DEEPGRAM_MODEL || 'nova-2';
        const wsUrl = `wss://api.deepgram.com/v1/listen?` +
            `model=${deepgramModel}&` +
            `language=${this.options.language || 'en-US'}&` +
            `encoding=opus&` +
            `container=webm&` +
            `sample_rate=48000&` +
            `channels=1&` +
            `punctuate=true&` +
            `interim_results=true&` +
            `endpointing=500&` +
            `utterance_end_ms=1500&` +
            `vad_events=true&` +
            `smart_format=true`;

        this.setState('connecting');
        console.log('[Deepgram] Connecting...');

        // Await WebSocket open before returning — ensures isRecognitionActiveRef
        // is only set after a real connection, and errors propagate to retry logic.
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

                    // Log every message type from Deepgram for debugging
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
                        // Log other message types (Metadata, SpeechStarted, etc.)
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

    private startRecording(): void {
        if (!this.stream || !this.socket) return;

        // Use MediaRecorder with WebM/Opus — Deepgram auto-detects the container format
        // This is the most reliable approach (no sample rate mismatch issues)
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

        let chunkCount = 0;
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(event.data);
                chunkCount++;
                if (chunkCount % 10 === 1) {
                    console.log(`[Deepgram] Sent audio chunk #${chunkCount} (${event.data.size} bytes)`);
                }
            }
        };

        // Send audio chunks every 250ms
        this.mediaRecorder.start(250);
        this.setState('recording');
        console.log(`[Deepgram] Recording started (${mimeType})`);
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

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;

        if (this.stream && !this.options.stream) {
            // Only stop tracks if WE acquired the stream (not pre-acquired by caller)
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
