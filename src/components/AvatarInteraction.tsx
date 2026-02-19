'use client';

/**
 * AvatarInteraction Component — Voice-First Conversation with Lip-Sync
 *
 * Audio Flow (critical for lip-sync):
 *   Fish Audio TTS → MP3 → decode to PCM16 (16kHz mono) → Simli.sendAudioData()
 *   → Simli backend renders lip-sync → LiveKit WebRTC → <video> + <audio autoPlay>
 *
 * The user NEVER hears audio directly from Fish Audio.
 * ALL audio goes through Simli so voice and lips are ALWAYS perfectly synced.
 * Simli outputs combined video+audio via WebRTC — one stream, one player, zero delay.
 *
 * Fallback: If Simli fails to connect, falls back to audio-only mode (direct MP3 playback).
 *
 * Full hands-free loop:
 * 1. Deepgram STT captures speech (client-side WebSocket)
 * 2. POST /api/agents/[id]/converse → RAG + Gemini → answer text
 * 3. POST /api/tts → Fish Audio → MP3 audio
 * 4. Decode MP3 → PCM16 (16kHz mono) → Simli.sendAudioData() → lip-synced output
 * 5. Simli emits 'silent' → auto-restart listening
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';
import { Loader2, User, Mic } from 'lucide-react';
import Image from 'next/image';
import { DeepgramSTT, isDeepgramConfigured } from '@/lib/deepgram';

// ─── PCM16 Conversion Helpers ───
// Simli expects raw PCM16 audio at 16kHz mono (confirmed from SimliClient source: sampleRate: 16000)
// Fish Audio TTS returns MP3. We decode and convert client-side via Web Audio API.

async function decodeMp3ToPcm16(
    mp3Buffer: ArrayBuffer
): Promise<{ pcm16: Uint8Array; durationMs: number }> {
    // Create AudioContext at 16kHz to auto-resample to Simli's expected rate
    const audioCtx = new AudioContext({ sampleRate: 16000 });

    try {
        const audioBuffer = await audioCtx.decodeAudioData(mp3Buffer);
        const durationMs = audioBuffer.duration * 1000;

        // Get mono channel (downmix if stereo)
        const float32 = audioBuffer.numberOfChannels > 1
            ? downmixToMono(audioBuffer)
            : audioBuffer.getChannelData(0);

        // Convert Float32 [-1, 1] → Int16 [-32768, 32767] (PCM16 little-endian)
        const pcm16 = new Uint8Array(float32.length * 2);
        const view = new DataView(pcm16.buffer);
        for (let i = 0; i < float32.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32[i]));
            view.setInt16(i * 2, sample * 32767, true); // little-endian
        }

        return { pcm16, durationMs };
    } finally {
        await audioCtx.close();
    }
}

function downmixToMono(audioBuffer: AudioBuffer): Float32Array {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i] + right[i]) / 2;
    }
    return mono;
}

// ─── Component ───

interface AvatarInteractionProps {
    simli_faceid: string;
    voiceId: string;
    initialPrompt?: string;
    facePreviewUrl?: string;
    agentName?: string;
    agentId: string;
    avatarEnabled?: boolean;
    onStart?: () => void;
    onStop?: () => void;
    onError?: (error: string) => void;
    onTranscript?: (text: string) => void;
    className?: string;
}

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
    simli_faceid,
    voiceId,
    facePreviewUrl,
    agentId,
    initialPrompt,
    avatarEnabled = true,
    onStart,
    onStop,
    onTranscript,
    className = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isAvatarVisible, setIsAvatarVisible] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState('');
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAudioOnlyMode, setIsAudioOnlyMode] = useState(false); // Fallback mode

    // Simli refs — video + audio are Simli's WebRTC output (synced lip-sync + voice)
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    // Fallback audio element — ONLY used when Simli is unavailable
    const fallbackAudioRef = useRef<HTMLAudioElement>(null);
    const simliClientRef = useRef<SimliClient | null>(null);
    const simliReadyRef = useRef<boolean>(false); // True when Simli has sent "connected" + sessionInitialized

    // Deepgram STT refs
    const deepgramRef = useRef<DeepgramSTT | null>(null);
    const isRecognitionActiveRef = useRef<boolean>(false);
    const handsFreeModeRef = useRef<boolean>(true);

    // Conversation state
    const conversationIdRef = useRef<string | null>(null);
    const isSpeakingRef = useRef<boolean>(false);

    // Transcript accumulation
    const accumulatedTranscriptRef = useRef<string>('');
    const utteranceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Audio buffer — accumulate PCM16 data before Simli is ready
    const pendingAudioRef = useRef<Uint8Array[]>([]);

    // Whether we should try Simli at all
    const shouldUseSimli = avatarEnabled && !!simli_faceid;

    // ─── Send buffered audio to Simli ───
    const flushPendingAudio = useCallback(() => {
        const client = simliClientRef.current;
        if (!client || !simliReadyRef.current) return;

        const pending = pendingAudioRef.current;
        if (pending.length > 0) {
            console.log(`[Simli] Flushing ${pending.length} buffered audio chunks`);
            for (const chunk of pending) {
                client.sendAudioData(chunk);
            }
            pendingAudioRef.current = [];
        }
    }, []);

    // ─── Send PCM16 audio to Simli (with buffering) ───
    const sendAudioToSimli = useCallback((pcm16: Uint8Array) => {
        const client = simliClientRef.current;

        // Simli expects chunks of ~6000 bytes (3000 samples at 16kHz)
        const CHUNK_SIZE = 6000;

        for (let i = 0; i < pcm16.length; i += CHUNK_SIZE) {
            const chunk = pcm16.slice(i, Math.min(i + CHUNK_SIZE, pcm16.length));

            if (client && simliReadyRef.current) {
                // Simli is ready — send directly
                client.sendAudioData(chunk);
            } else {
                // Simli not ready yet — buffer for later
                pendingAudioRef.current.push(chunk);
            }
        }
    }, []);

    // ─── Initialize Simli client ───
    const initializeSimliClient = useCallback(async (): Promise<boolean> => {
        if (!shouldUseSimli) return false;

        console.log('=== Simli Initialization ===');
        console.log('Face ID:', simli_faceid);

        if (!videoRef.current || !audioRef.current) {
            console.error('[Simli] Video/Audio elements not ready');
            setError('Video element not ready. Please try again.');
            setIsLoading(false);
            return false;
        }

        try {
            // Fetch session token from server (API key stays server-side)
            const tokenRes = await fetch('/api/auth/simli-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceId: simli_faceid }),
            });

            if (!tokenRes.ok) {
                throw new Error('Failed to get Simli session token');
            }

            const { sessionToken } = await tokenRes.json();

            const simliClient = new SimliClient();

            simliClient.Initialize({
                apiKey: sessionToken,
                faceID: simli_faceid,
                handleSilence: true,
                maxSessionLength: 600,
                maxIdleTime: 300,
                videoRef: videoRef.current,
                audioRef: audioRef.current,
            } as Parameters<typeof simliClient.Initialize>[0]);

            // ─── Simli Events ───

            simliClient.on('connected', () => {
                console.log('[Simli] ✅ Connected — session initialized');
                simliReadyRef.current = true;
                setIsAvatarVisible(true);
                setIsLoading(false);

                // Send initial silence to keep connection alive (required by Simli)
                const silence = new Uint8Array(6000).fill(0);
                simliClient.sendAudioData(silence);

                // Flush any audio that was buffered while waiting for connection
                flushPendingAudio();
            });

            simliClient.on('disconnected', () => {
                console.log('[Simli] Disconnected');
                simliReadyRef.current = false;
                setIsAvatarVisible(false);
            });

            simliClient.on('failed', () => {
                console.warn('[Simli] ❌ Connection failed — falling back to audio-only');
                simliReadyRef.current = false;
                setIsAudioOnlyMode(true);
                setIsLoading(false);
                setError('Avatar unavailable. Using voice-only mode.');
            });

            // Simli emits 'speaking' when it starts playing the lip-synced audio+video
            simliClient.on('speaking', () => {
                console.log('[Simli] 🗣️ Speaking (lip-sync active)');
                isSpeakingRef.current = true;
            });

            // Simli emits 'silent' when it finishes — THIS is when we restart listening
            simliClient.on('silent', () => {
                console.log('[Simli] 🤫 Silent (lip-sync done)');
                isSpeakingRef.current = false;

                // Clear safety timeout since Simli told us it's done
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
                }

                // Auto-restart listening after a tiny delay (avoid catching echo)
                if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                    setTimeout(() => {
                        const startEvent = new CustomEvent('startListening');
                        document.dispatchEvent(startEvent);
                    }, 300);
                }
            });

            simliClientRef.current = simliClient;
            simliClient.start();
            return true;
        } catch (err) {
            console.error('[Simli] Initialization failed:', err);
            setIsAudioOnlyMode(true);
            setIsLoading(false);
            setError('Avatar unavailable. Using voice-only mode.');
            return false;
        }
    }, [simli_faceid, shouldUseSimli, flushPendingAudio]);

    /**
     * Core conversation function — the heart of the voice pipeline
     *
     * AUDIO FLOW:
     * 1. POST query to /api/agents/[id]/converse → answer text
     * 2. POST answer to /api/tts → MP3 audio from Fish Audio
     * 3. SIMLI MODE: Decode MP3 → PCM16 → sendAudioData() → Simli renders lip-sync
     *    → User hears audio FROM Simli's WebRTC <audio> element (synced with video)
     *    FALLBACK MODE: Play MP3 directly through fallbackAudioRef
     *
     * CRITICAL: In Simli mode, the user NEVER hears audio from Fish Audio directly.
     * All audio goes through Simli so that lips and voice are perfectly synchronized.
     */
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isProcessing) return;

        console.log(`[Converse] User said: "${text}"`);
        setIsProcessing(true);
        isSpeakingRef.current = true;
        onTranscript?.(text);

        // Stop listening while we process + speak
        deepgramRef.current?.stop();
        deepgramRef.current = null;
        isRecognitionActiveRef.current = false;
        setIsListening(false);

        // Clear any pending restart timeout
        if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = null;
        }

        try {
            // ── Step 1: Get answer from RAG pipeline ──
            const converseResponse = await fetch(`/api/agents/${agentId}/converse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: text.trim(),
                    conversationId: conversationIdRef.current,
                }),
            });

            if (!converseResponse.ok) {
                const err = await converseResponse.json();
                throw new Error(err.error || 'Failed to get response');
            }

            const data = await converseResponse.json();
            const answer = data.answer;
            conversationIdRef.current = data.conversationId;

            console.log(`[Converse] Answer: "${answer.slice(0, 80)}..."`);
            console.log(`[Converse] Retrieval: ${data.retrievalTimeMs}ms, Generation: ${data.generationTimeMs}ms`);

            // ── Step 2: Convert answer to audio via Fish Audio TTS ──
            const ttsResponse = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: answer,
                    voiceId: voiceId,
                }),
            });

            if (!ttsResponse.ok) {
                throw new Error('TTS generation failed');
            }

            const mp3Buffer = await ttsResponse.arrayBuffer();
            console.log(`[Converse] TTS audio: ${mp3Buffer.byteLength} bytes`);

            // ── Step 3: Route audio through the correct path ──

            if (simliClientRef.current && (simliReadyRef.current || isAvatarVisible) && !isAudioOnlyMode) {
                // ═══════════════════════════════════════════════
                // SIMLI MODE — All audio goes through Simli
                // User hears audio FROM Simli's WebRTC stream
                // Lips and voice are perfectly synchronized
                // ═══════════════════════════════════════════════

                const { pcm16, durationMs } = await decodeMp3ToPcm16(mp3Buffer);
                console.log(`[Converse] Decoded PCM16: ${pcm16.length} bytes, ${Math.round(durationMs)}ms`);
                console.log(`[Converse] Sending to Simli for lip-synced playback...`);

                // Send ALL audio to Simli — it will render lip-sync and output via WebRTC
                sendAudioToSimli(pcm16);

                setIsProcessing(false);

                // Simli's 'silent' event will restart listening (see event handler above).
                // Safety fallback: if Simli doesn't emit 'silent' within expected time,
                // restart listening anyway to prevent getting stuck.
                restartTimeoutRef.current = setTimeout(() => {
                    console.log('[Converse] Safety timeout — restarting listener');
                    if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                        isSpeakingRef.current = false;
                        const startEvent = new CustomEvent('startListening');
                        document.dispatchEvent(startEvent);
                    }
                }, durationMs + 3000); // audio duration + 3s buffer

            } else {
                // ═══════════════════════════════════════════════
                // AUDIO-ONLY FALLBACK — Play MP3 directly
                // Used when Simli is unavailable or disabled
                // ═══════════════════════════════════════════════

                console.log('[Converse] Playing audio directly (audio-only fallback)');

                const blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);

                if (fallbackAudioRef.current) {
                    fallbackAudioRef.current.src = url;

                    fallbackAudioRef.current.onended = () => {
                        URL.revokeObjectURL(url);
                        isSpeakingRef.current = false;
                        setIsProcessing(false);

                        // Auto-restart listening after playback ends
                        if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                            setTimeout(() => {
                                const startEvent = new CustomEvent('startListening');
                                document.dispatchEvent(startEvent);
                            }, 300);
                        }
                    };

                    fallbackAudioRef.current.onerror = () => {
                        URL.revokeObjectURL(url);
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                    };

                    await fallbackAudioRef.current.play();
                } else {
                    // No audio element at all — just move on
                    isSpeakingRef.current = false;
                    setIsProcessing(false);
                }
            }

        } catch (err) {
            console.error('[Converse] Error:', err);
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setIsProcessing(false);
            isSpeakingRef.current = false;

            // Still restart listening on error so conversation can continue
            if (handsFreeModeRef.current) {
                setTimeout(() => {
                    const startEvent = new CustomEvent('startListening');
                    document.dispatchEvent(startEvent);
                }, 1000);
            }
        }
    }, [agentId, voiceId, onTranscript, isProcessing, isAvatarVisible, isAudioOnlyMode, sendAudioToSimli]);

    /**
     * Play greeting message through TTS when session starts.
     * Routes through Simli (if active) or fallback audio, then starts listening.
     */
    const playGreeting = useCallback(async (greetingText: string) => {
        if (!greetingText.trim()) return;

        console.log(`[Greeting] Playing: "${greetingText}"`);
        isSpeakingRef.current = true;
        setIsProcessing(true);

        try {
            // Convert greeting to audio via Fish Audio TTS
            const ttsResponse = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: greetingText, voiceId }),
            });

            if (!ttsResponse.ok) throw new Error('TTS failed for greeting');

            const mp3Buffer = await ttsResponse.arrayBuffer();
            console.log(`[Greeting] TTS audio: ${mp3Buffer.byteLength} bytes`);

            if (simliClientRef.current && (simliReadyRef.current || isAvatarVisible) && !isAudioOnlyMode) {
                // Simli mode — send through avatar for lip-sync
                const { pcm16, durationMs } = await decodeMp3ToPcm16(mp3Buffer);
                console.log(`[Greeting] Sending to Simli: ${pcm16.length} bytes, ${Math.round(durationMs)}ms`);
                sendAudioToSimli(pcm16);
                setIsProcessing(false);

                // Simli 'silent' event will trigger listening restart.
                // Safety fallback timeout:
                restartTimeoutRef.current = setTimeout(() => {
                    if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                        isSpeakingRef.current = false;
                        const startEvent = new CustomEvent('startListening');
                        document.dispatchEvent(startEvent);
                    }
                }, durationMs + 3000);
            } else {
                // Audio-only fallback
                const blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);

                if (fallbackAudioRef.current) {
                    fallbackAudioRef.current.src = url;
                    fallbackAudioRef.current.onended = () => {
                        URL.revokeObjectURL(url);
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                        if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                            setTimeout(() => {
                                const startEvent = new CustomEvent('startListening');
                                document.dispatchEvent(startEvent);
                            }, 300);
                        }
                    };
                    await fallbackAudioRef.current.play();
                } else {
                    isSpeakingRef.current = false;
                    setIsProcessing(false);
                }
            }
        } catch (err) {
            console.error('[Greeting] Error:', err);
            isSpeakingRef.current = false;
            setIsProcessing(false);
            // Still start listening even if greeting fails
            if (handsFreeModeRef.current) {
                setTimeout(() => {
                    const startEvent = new CustomEvent('startListening');
                    document.dispatchEvent(startEvent);
                }, 500);
            }
        }
    }, [voiceId, isAvatarVisible, isAudioOnlyMode, sendAudioToSimli]);

    // ─── Initialize Deepgram STT ───
    const initializeDeepgram = useCallback(() => {
        if (!isDeepgramConfigured()) {
            console.warn('Deepgram API key not configured');
            return null;
        }

        const deepgram = new DeepgramSTT({
            onTranscript: (transcriptData) => {
                setTranscript(transcriptData.text);

                if (utteranceTimeoutRef.current) {
                    clearTimeout(utteranceTimeoutRef.current);
                }

                if (transcriptData.isFinal && transcriptData.text.trim()) {
                    console.log('Final transcript:', transcriptData.text);
                    sendMessage(transcriptData.text);
                    setTranscript('');
                    accumulatedTranscriptRef.current = '';
                } else if (transcriptData.text.trim()) {
                    accumulatedTranscriptRef.current = transcriptData.text;

                    // If no final transcript within 2s, send what we have
                    utteranceTimeoutRef.current = setTimeout(() => {
                        if (accumulatedTranscriptRef.current.trim()) {
                            console.log('Timeout transcript:', accumulatedTranscriptRef.current);
                            sendMessage(accumulatedTranscriptRef.current);
                            setTranscript('');
                            accumulatedTranscriptRef.current = '';
                        }
                    }, 2000);
                }
            },
            onError: () => {
                isRecognitionActiveRef.current = false;
                setIsListening(false);
            },
            onClose: () => {
                if (accumulatedTranscriptRef.current.trim()) {
                    sendMessage(accumulatedTranscriptRef.current);
                    accumulatedTranscriptRef.current = '';
                }
                isRecognitionActiveRef.current = false;
                setIsListening(false);
            },
            language: 'en-US'
        });

        return deepgram;
    }, [sendMessage]);

    // Start listening
    const startListening = useCallback(async () => {
        if (isRecognitionActiveRef.current || isSpeakingRef.current) return;

        deepgramRef.current = initializeDeepgram();
        if (!deepgramRef.current) return;

        try {
            await deepgramRef.current.start();
            isRecognitionActiveRef.current = true;
            setIsListening(true);
        } catch {
            isRecognitionActiveRef.current = false;
            setIsListening(false);
        }
    }, [initializeDeepgram]);

    // Stop listening
    const stopListening = useCallback(() => {
        deepgramRef.current?.stop();
        deepgramRef.current = null;
        isRecognitionActiveRef.current = false;
        setIsListening(false);
    }, []);

    // Handle start button click
    const handleStart = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setIsAudioOnlyMode(false);
        conversationIdRef.current = null;
        simliReadyRef.current = false;
        pendingAudioRef.current = [];
        onStart?.();

        if (shouldUseSimli) {
            const simliStarted = await initializeSimliClient();
            if (!simliStarted) {
                // Simli init failed immediately — start audio-only
                setIsAudioOnlyMode(true);
                setIsLoading(false);
                // Play greeting, then auto-start listening after it finishes
                if (initialPrompt) {
                    playGreeting(initialPrompt);
                } else {
                    startListening();
                }
            } else {
                // Wait for Simli to connect, then play greeting
                setTimeout(() => {
                    if (initialPrompt) {
                        playGreeting(initialPrompt);
                    } else {
                        startListening();
                    }
                }, 2500);
            }
        } else {
            // Audio-only mode — no Simli
            setIsAudioOnlyMode(true);
            setIsLoading(false);
            // Play greeting, then auto-start listening after it finishes
            if (initialPrompt) {
                playGreeting(initialPrompt);
            } else {
                startListening();
            }
        }
    }, [onStart, initializeSimliClient, startListening, shouldUseSimli, initialPrompt, playGreeting]);

    // Handle stop button click
    const handleStop = useCallback(() => {
        stopListening();

        // Close Simli connection
        simliClientRef.current?.close();
        simliReadyRef.current = false;

        // Stop any fallback audio
        if (fallbackAudioRef.current) {
            fallbackAudioRef.current.pause();
            fallbackAudioRef.current.src = '';
        }

        if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = null;
        }

        if (utteranceTimeoutRef.current) {
            clearTimeout(utteranceTimeoutRef.current);
            utteranceTimeoutRef.current = null;
        }

        pendingAudioRef.current = [];

        setIsLoading(false);
        setIsAvatarVisible(false);
        setIsAudioOnlyMode(false);
        setIsListening(false);
        setError('');
        setIsProcessing(false);
        setTranscript('');

        isRecognitionActiveRef.current = false;
        isSpeakingRef.current = false;
        simliClientRef.current = null;
        conversationIdRef.current = null;
        accumulatedTranscriptRef.current = '';
        onStop?.();
    }, [onStop, stopListening]);

    // Listen for startListening custom event (hands-free auto-restart)
    useEffect(() => {
        const handleStartListening = () => {
            if (handsFreeModeRef.current && !isRecognitionActiveRef.current && !isSpeakingRef.current) {
                startListening();
            }
        };

        document.addEventListener('startListening', handleStartListening);
        return () => {
            document.removeEventListener('startListening', handleStartListening);
        };
    }, [startListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            deepgramRef.current?.stop();
            simliClientRef.current?.close();
            simliReadyRef.current = false;
            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
            }
            if (utteranceTimeoutRef.current) {
                clearTimeout(utteranceTimeoutRef.current);
            }
        };
    }, []);

    const isRunning = isAvatarVisible || isAudioOnlyMode;

    return (
        <div className={`relative ${className}`}>
            {/* Error display */}
            {error && (
                <div className="absolute top-4 left-4 right-4 z-10 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {/* Video/Audio container */}
            <div className="relative aspect-square bg-slate-900 rounded-2xl overflow-hidden">
                {/*
                  Simli WebRTC output elements:
                  - <video> shows the lip-synced avatar
                  - <audio> plays the synced voice audio
                  BOTH are driven by Simli's LiveKit WebRTC stream.
                  The user sees lips move at the EXACT same moment they hear the words.
                */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 w-full h-full object-cover ${isAvatarVisible ? '' : 'hidden'}`}
                />
                {/* Simli's audio output — this is how the user hears the synced voice */}
                <audio ref={audioRef} autoPlay />
                {/* Fallback audio — ONLY used when Simli is unavailable */}
                <audio ref={fallbackAudioRef} />

                {/* Loading overlay */}
                {isLoading && !isRunning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                            <p className="text-white text-sm">
                                {shouldUseSimli ? 'Connecting to avatar...' : 'Starting voice mode...'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Audio-only mode visualization */}
                {isAudioOnlyMode && !isAvatarVisible && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${
                                isListening
                                    ? 'bg-red-500/20 ring-4 ring-red-500/30 animate-pulse'
                                    : isProcessing
                                        ? 'bg-orange-500/20 ring-4 ring-orange-500/30'
                                        : 'bg-white/10'
                            }`}>
                                <Mic className={`w-10 h-10 ${
                                    isListening ? 'text-red-400' : isProcessing ? 'text-orange-400' : 'text-white/60'
                                }`} />
                            </div>
                            <p className="text-gray-400 text-sm">
                                {isListening ? 'Listening...' : isProcessing ? 'Thinking...' : 'Voice mode active'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Placeholder when not active */}
                {!isLoading && !isRunning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {facePreviewUrl ? (
                            <>
                                <Image
                                    src={facePreviewUrl}
                                    alt="Agent face"
                                    fill
                                    className="object-cover"
                                    sizes="400px"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/30" />
                                <div className="absolute bottom-8 left-0 right-0 text-center">
                                    <p className="text-white/90 text-lg font-medium">Click Start to begin</p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <div className="w-24 h-24 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center">
                                    <User className="w-12 h-12 text-white" />
                                </div>
                                <p className="text-gray-400">Click Start to begin</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Live transcript display */}
                {isListening && transcript && (
                    <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-black/60 border border-white/20">
                        <p className="text-white text-sm italic">{transcript}...</p>
                    </div>
                )}

                {/* Listening indicator (avatar mode) */}
                {isAvatarVisible && isListening && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-xs">Listening...</span>
                    </div>
                )}

                {/* Processing indicator (avatar mode) */}
                {isAvatarVisible && isProcessing && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                        <span className="text-white text-xs">Thinking...</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="mt-4 flex justify-center">
                {!isRunning ? (
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="w-full py-3 px-6 rounded-xl bg-[#1a1a1a] border border-white/10 hover:bg-[#252525] text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Connecting...' : 'Start Interaction'}
                    </button>
                ) : (
                    <button
                        onClick={handleStop}
                        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
                        title="End conversation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default AvatarInteraction;
