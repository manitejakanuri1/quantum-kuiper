// Deepgram STT Client
// Real-time speech-to-text using Deepgram WebSocket API

const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

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
}

export class DeepgramSTT {
    private socket: WebSocket | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private options: DeepgramSTTOptions;
    private isConnected: boolean = false;

    constructor(options: DeepgramSTTOptions) {
        this.options = options;
    }

    async start(): Promise<void> {
        if (!DEEPGRAM_API_KEY) {
            throw new Error('Deepgram API key not configured');
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
        const wsUrl = `wss://api.deepgram.com/v1/listen?` +
            `model=nova-2&` +
            `language=${this.options.language || 'en-US'}&` +
            `punctuate=true&` +
            `interim_results=true&` +
            `endpointing=300&` +
            `vad_events=true`;

        this.socket = new WebSocket(wsUrl, ['token', DEEPGRAM_API_KEY]);

        this.socket.onopen = () => {
            console.log('[Deepgram] Connected');
            this.isConnected = true;
            this.startRecording();
        };

        this.socket.onmessage = (event) => {
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
            this.options.onClose?.();
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

    stop(): void {
        console.log('[Deepgram] Stopping...');

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
    }

    get connected(): boolean {
        return this.isConnected;
    }
}

/**
 * Check if Deepgram is configured
 */
export function isDeepgramConfigured(): boolean {
    return !!DEEPGRAM_API_KEY;
}
