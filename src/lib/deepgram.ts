// Deepgram STT Client
// Real-time speech-to-text using Deepgram WebSocket API
// Uses temporary tokens fetched from /api/auth/deepgram-token (API key stays server-side)

export interface DeepgramTranscript {
    text: string;
    isFinal: boolean;
    confidence: number;
}

export interface DeepgramSTTOptions {
    onTranscript: (transcript: DeepgramTranscript) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    language?: string;
    apiKey?: string; // Temporary token from server
    agentId?: string; // Passed to token endpoint for validation
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

    constructor(options: DeepgramSTTOptions) {
        this.options = options;
        this.apiKey = options.apiKey || null;
    }

    async start(): Promise<void> {
        // Fetch temp token from server if not provided
        if (!this.apiKey) {
            try {
                const res = await fetch('/api/auth/deepgram-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: this.options.agentId }),
                });
                if (!res.ok) throw new Error('Failed to get Deepgram token');
                const data = await res.json();
                this.apiKey = data.token;
            } catch (err) {
                throw new Error('Failed to get Deepgram token from server');
            }
        }

        if (!this.apiKey) {
            throw new Error('Deepgram token not available');
        }

        // Get microphone access
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });
        } catch (err) {
            throw new Error('Failed to access microphone');
        }

        // Connect to Deepgram WebSocket
        const deepgramModel = process.env.NEXT_PUBLIC_DEEPGRAM_MODEL || 'nova-2';
        const wsUrl = `wss://api.deepgram.com/v1/listen?` +
            `model=${deepgramModel}&` +
            `language=${this.options.language || 'en-US'}&` +
            `punctuate=true&` +
            `interim_results=true&` +
            `endpointing=300&` +
            `vad_events=true`;

        this.socket = new WebSocket(wsUrl, ['token', this.apiKey]);

        this.socket.onopen = () => {
            console.log('[Deepgram] Connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.lastMessageTime = Date.now();
            this.startRecording();
            this.startHeartbeat();
        };

        this.socket.onmessage = (event) => {
            this.lastMessageTime = Date.now();

            try {
                const data = JSON.parse(event.data);

                if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
                    const alternative = data.channel.alternatives[0];
                    const transcript: DeepgramTranscript = {
                        text: alternative.transcript || '',
                        isFinal: data.is_final || false,
                        confidence: alternative.confidence || 0
                    };

                    if (transcript.text) {
                        this.options.onTranscript(transcript);
                    }
                }
            } catch (err) {
                console.error('[Deepgram] Parse error:', err);
            }
        };

        this.socket.onerror = (event) => {
            console.error('[Deepgram] WebSocket error:', event);
            this.options.onError?.(new Error('Deepgram connection error'));
        };

        this.socket.onclose = () => {
            console.log('[Deepgram] Disconnected');
            this.isConnected = false;
            this.stopHeartbeat();

            // Attempt reconnection if not manually stopped
            if (this.shouldReconnect && this.stream) {
                this.reconnect();
            } else {
                this.options.onClose?.();
            }
        };
    }

    private startRecording(): void {
        if (!this.stream || !this.socket) return;

        // Use MediaRecorder to capture audio
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType,
            audioBitsPerSecond: 128000
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(event.data);
            }
        };

        // Send audio chunks every 250ms
        this.mediaRecorder.start(250);
        console.log('[Deepgram] Recording started');
    }

    private reconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Deepgram] Max reconnection attempts reached');
            this.options.onError?.(new Error('Failed to reconnect to Deepgram'));
            this.options.onClose?.();
            return;
        }

        this.reconnectAttempts++;
        const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1); // 1s, 2s, 4s

        console.log(`[Deepgram] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        this.reconnectTimer = setTimeout(() => {
            console.log('[Deepgram] Attempting to reconnect...');
            this.start().catch(err => {
                console.error('[Deepgram] Reconnection failed:', err);
            });
        }, delay);
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();

        // Check connection health every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            const timeSinceLastMessage = Date.now() - this.lastMessageTime;

            // If no message received in 60 seconds, connection may be stale
            if (timeSinceLastMessage > 60000) {
                console.warn('[Deepgram] Connection appears stale, reconnecting...');
                if (this.socket) {
                    this.socket.close();
                }
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

        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Stop heartbeat
        this.stopHeartbeat();

        // Stop MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;

        // Stop microphone stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.stream = null;

        // Close WebSocket
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // Send close message to Deepgram
            this.socket.send(JSON.stringify({ type: 'CloseStream' }));
            this.socket.close();
        }
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    get connected(): boolean {
        return this.isConnected;
    }
}

/**
 * Check if Deepgram is configured (always true — token is fetched from server)
 */
export function isDeepgramConfigured(): boolean {
    return true;
}
