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
import { DeepgramSTT, DeepgramState, isDeepgramConfigured } from '@/lib/deepgram';

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

    // Pipeline status indicator (Fix A) — shows exactly where in the pipeline we are
    const [pipelineStatus, setPipelineStatus] = useState('');
    const [deepgramState, setDeepgramState] = useState<DeepgramState>('idle');

    // Chat messages visible on screen
    const [userMessage, setUserMessage] = useState('');    // What user said
    const [aiMessage, setAiMessage] = useState('');        // What AI replied

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
    const micStreamRef = useRef<MediaStream | null>(null); // Pre-acquired mic (user gesture)

    // Conversation state
    const conversationIdRef = useRef<string | null>(null);
    const isSpeakingRef = useRef<boolean>(false);

    // Transcript accumulation
    const accumulatedTranscriptRef = useRef<string>('');
    const utteranceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Audio buffer — accumulate PCM16 data before Simli is ready
    const pendingAudioRef = useRef<Uint8Array[]>([]);

    // Fix C: isProcessing safety timeout ref (30s max)
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Ref to always hold the latest sendMessage (prevents stale closures in Deepgram callbacks)
    const sendMessageRef = useRef<(text: string) => void>(() => {});

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
                body: JSON.stringify({ faceId: simli_faceid, agentId }),
            });

            if (!tokenRes.ok) {
                throw new Error('Failed to get Simli session token');
            }

            const { sessionToken } = await tokenRes.json();

            const simliClient = new SimliClient();

            simliClient.Initialize({
                apiKey: "",
                session_token: sessionToken,
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
                setPipelineStatus('Avatar ready');

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
                pendingAudioRef.current = [];
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
        if (!text.trim()) {
            console.warn('[Converse] Empty text — skipping');
            return;
        }
        if (isProcessing) {
            console.warn('[Converse] ⚠️ BLOCKED by isProcessing=true — dropping:', text);
            return;
        }

        console.log(`[Converse] ✅ User said: "${text}" — sending to backend`);
        setIsProcessing(true);
        isSpeakingRef.current = true;
        setUserMessage(text);
        setAiMessage('');  // Clear previous AI reply
        setPipelineStatus('Thinking...');
        onTranscript?.(text);

        // Fix C: Safety timeout — if isProcessing stays true for 30s, force reset
        if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = setTimeout(() => {
            console.warn('[Converse] ⚠️ isProcessing timeout (30s) — force resetting');
            setIsProcessing(false);
            isSpeakingRef.current = false;
            setPipelineStatus('Timeout — restarting...');
            if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                document.dispatchEvent(new CustomEvent('startListening'));
            }
        }, 30000);

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
            setPipelineStatus('Getting AI response...');
            console.log(`[Converse] 📡 Fetching /api/agents/${agentId}/converse...`);
            const converseResponse = await fetch(`/api/agents/${agentId}/converse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: text.trim(),
                    conversationId: conversationIdRef.current,
                }),
            });

            console.log(`[Converse] Backend responded: ${converseResponse.status}`);

            if (!converseResponse.ok) {
                const err = await converseResponse.json();
                console.error(`[Converse] ❌ Backend error:`, err);
                throw new Error(err.error || 'Failed to get response');
            }

            const data = await converseResponse.json();
            const answer = data.answer;
            conversationIdRef.current = data.conversationId;
            setAiMessage(answer);  // Show AI response on screen

            console.log(`[Converse] ✅ Answer: "${answer.slice(0, 80)}..."`);
            console.log(`[Converse] Retrieval: ${data.retrievalTimeMs}ms, Generation: ${data.generationTimeMs}ms`);

            // ── Step 2: Convert answer to audio via Fish Audio TTS ──
            setPipelineStatus('Generating speech...');
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
                setPipelineStatus('Speaking...');

                setIsProcessing(false);
                if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }

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
                setPipelineStatus('Speaking...');
                if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }

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
            setPipelineStatus('Error — retrying...');
            setIsProcessing(false);
            isSpeakingRef.current = false;
            if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }

            // Still restart listening on error so conversation can continue
            if (handsFreeModeRef.current) {
                setTimeout(() => {
                    const startEvent = new CustomEvent('startListening');
                    document.dispatchEvent(startEvent);
                }, 1000);
            }
        }
    }, [agentId, voiceId, onTranscript, isProcessing, isAvatarVisible, isAudioOnlyMode, sendAudioToSimli]);

    // Keep sendMessageRef always pointing to the latest sendMessage
    sendMessageRef.current = sendMessage;

    /**
     * Play greeting message through TTS when session starts.
     * Routes through Simli (if active) or fallback audio, then starts listening.
     */
    const playGreeting = useCallback(async (greetingText: string) => {
        if (!greetingText.trim()) return;

        console.log(`[Greeting] Playing: "${greetingText}"`);
        isSpeakingRef.current = true;
        setIsProcessing(true);
        setPipelineStatus('Playing greeting...');

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
                setPipelineStatus('Speaking...');
                setIsProcessing(false);

                // Unconditional listening restart after greeting finishes.
                // Don't depend on Simli 'silent' event (it often doesn't fire for short greetings).
                // Force-reset isSpeakingRef so listening guards won't block.
                restartTimeoutRef.current = setTimeout(() => {
                    console.log('[Greeting] Safety restart — starting listener after greeting');
                    isSpeakingRef.current = false;
                    setIsProcessing(false);
                    if (handsFreeModeRef.current) {
                        // Dispatch event with isSpeakingRef already reset
                        document.dispatchEvent(new CustomEvent('startListening'));
                    }
                }, durationMs + 2000);
            } else {
                // Audio-only fallback
                const blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);

                if (fallbackAudioRef.current) {
                    fallbackAudioRef.current.src = url;

                    // Backup timeout in case onended never fires
                    const { durationMs: fallbackDuration } = await decodeMp3ToPcm16(mp3Buffer.slice(0));
                    const fallbackTimeout = setTimeout(() => {
                        console.log('[Greeting] Fallback backup timeout — force-starting listener');
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                        document.dispatchEvent(new CustomEvent('startListening'));
                    }, fallbackDuration + 5000);

                    fallbackAudioRef.current.onended = () => {
                        clearTimeout(fallbackTimeout);
                        URL.revokeObjectURL(url);
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                        if (handsFreeModeRef.current) {
                            setTimeout(() => {
                                document.dispatchEvent(new CustomEvent('startListening'));
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
            setPipelineStatus('Greeting failed — starting mic...');
            // Fix D: Still start listening even if greeting fails (non-blocking)
            if (handsFreeModeRef.current) {
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('startListening'));
                }, 500);
            }
        }
    }, [voiceId, isAvatarVisible, isAudioOnlyMode, sendAudioToSimli]);

    // ─── Initialize Deepgram STT ───
    // Uses sendMessageRef (not sendMessage directly) to always call the latest version
    // and avoid stale closures where isProcessing might be permanently true.
    const initializeDeepgram = useCallback(() => {
        if (!isDeepgramConfigured()) {
            console.warn('Deepgram API key not configured');
            return null;
        }

        console.log('[STT] Initializing Deepgram STT...');

        const deepgram = new DeepgramSTT({
            onTranscript: (transcriptData) => {
                console.log('[STT] onTranscript:', {
                    text: transcriptData.text,
                    isFinal: transcriptData.isFinal,
                    confidence: transcriptData.confidence,
                });

                if (transcriptData.isFinal && transcriptData.text.trim()) {
                    // Deepgram detected end of speech — send the full utterance
                    console.log('[STT] ✅ Final utterance — calling sendMessage:', transcriptData.text);
                    setTranscript('');
                    accumulatedTranscriptRef.current = '';
                    // Use ref to always get the latest sendMessage (prevents stale closure)
                    sendMessageRef.current(transcriptData.text);
                } else if (transcriptData.text.trim()) {
                    // Interim result — show live preview
                    setTranscript(transcriptData.text);
                    accumulatedTranscriptRef.current = transcriptData.text;

                    // Safety timeout: if Deepgram never sends speech_final/UtteranceEnd,
                    // send what we have after 3 seconds of no new interim results
                    if (utteranceTimeoutRef.current) {
                        clearTimeout(utteranceTimeoutRef.current);
                    }
                    utteranceTimeoutRef.current = setTimeout(() => {
                        if (accumulatedTranscriptRef.current.trim()) {
                            console.log('[STT] ⏱️ Timeout — calling sendMessage:', accumulatedTranscriptRef.current);
                            const text = accumulatedTranscriptRef.current;
                            setTranscript('');
                            accumulatedTranscriptRef.current = '';
                            sendMessageRef.current(text);
                        }
                    }, 3000);
                }
            },
            onError: (err) => {
                console.error('[STT] Deepgram error:', err);
                isRecognitionActiveRef.current = false;
                setIsListening(false);
            },
            onClose: () => {
                console.log('[STT] Deepgram connection closed');
                isRecognitionActiveRef.current = false;
                setIsListening(false);
            },
            onStateChange: (state: DeepgramState) => {
                console.log('[STT] Deepgram state:', state);
                setDeepgramState(state);
                // Update pipeline status based on Deepgram state
                if (state === 'fetching-token') setPipelineStatus('Getting speech token...');
                else if (state === 'mic-request') setPipelineStatus('Requesting microphone...');
                else if (state === 'connecting') setPipelineStatus('Connecting speech engine...');
                else if (state === 'connected') setPipelineStatus('Speech engine connected');
                else if (state === 'recording') setPipelineStatus('Listening...');
                else if (state === 'error') setPipelineStatus('Speech engine error');
                else if (state === 'closed') setPipelineStatus('');
            },
            language: 'en-US',
            agentId,
            stream: micStreamRef.current || undefined, // Pass pre-acquired mic stream
        });

        return deepgram;
    }, [agentId]); // sendMessage accessed via sendMessageRef (ref never changes)

    // Start listening
    const startListening = useCallback(async () => {
        if (isRecognitionActiveRef.current) {
            console.log('[STT] startListening blocked: already active');
            return;
        }
        if (isSpeakingRef.current) {
            console.log('[STT] startListening blocked: avatar still speaking');
            return;
        }

        console.log('[STT] 🎙️ Starting Deepgram listener...');
        deepgramRef.current = initializeDeepgram();
        if (!deepgramRef.current) return;

        try {
            await deepgramRef.current.start();
            isRecognitionActiveRef.current = true;
            setIsListening(true);
            console.log('[STT] 🎙️ Listening active — speak now');
        } catch (err) {
            console.error('[STT] Failed to start Deepgram:', err);
            isRecognitionActiveRef.current = false;
            setIsListening(false);
            throw err; // Re-throw so startListeningWithRetry can retry
        }
    }, [initializeDeepgram]);

    // Stop listening
    const stopListening = useCallback(() => {
        deepgramRef.current?.stop();
        deepgramRef.current = null;
        isRecognitionActiveRef.current = false;
        setIsListening(false);
    }, []);

    // Fix B: Start listening with retry (up to 3 attempts)
    const startListeningWithRetry = useCallback(async (attempt = 1) => {
        try {
            setPipelineStatus(`Starting mic${attempt > 1 ? ` (attempt ${attempt}/3)` : ''}...`);
            await startListening();
            setPipelineStatus('Listening...');
        } catch (err) {
            console.warn(`[STT] startListening attempt ${attempt}/3 failed:`, err);
            if (attempt < 3) {
                setPipelineStatus(`Mic failed, retrying in 2s (${attempt}/3)...`);
                setTimeout(() => startListeningWithRetry(attempt + 1), 2000);
            } else {
                setPipelineStatus('Microphone unavailable');
                setError('Could not start microphone after 3 attempts. Check mic permissions.');
            }
        }
    }, [startListening]);

    // Handle start button click
    const handleStart = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setIsAudioOnlyMode(false);
        setPipelineStatus('Requesting microphone...');
        conversationIdRef.current = null;
        simliReadyRef.current = false;
        pendingAudioRef.current = [];
        onStart?.();

        // Request mic permission IMMEDIATELY while we have user gesture context.
        // getUserMedia requires user gesture in most browsers. If we delay it
        // (e.g., after Simli connects + greeting plays), the gesture expires
        // and the browser silently denies mic access.
        try {
            micStreamRef.current = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
            console.log('[Pipeline] ✅ Microphone access granted (pre-acquired)');
            setPipelineStatus('Connecting to avatar...');
        } catch (micErr) {
            console.error('[Pipeline] ❌ Microphone denied:', micErr);
            setError('Microphone access denied. Please allow mic permission and try again.');
            setIsLoading(false);
            setPipelineStatus('');
            return; // Can't proceed without mic
        }

        if (shouldUseSimli) {
            const simliStarted = await initializeSimliClient();
            if (!simliStarted) {
                // Simli init failed immediately — start audio-only
                setIsAudioOnlyMode(true);
                setIsLoading(false);
                setPipelineStatus('Avatar unavailable — voice only');
                if (initialPrompt) {
                    playGreeting(initialPrompt);
                } else {
                    startListeningWithRetry();
                }
            } else {
                // Wait for Simli to connect, then play greeting
                setPipelineStatus('Waiting for avatar...');
                setTimeout(() => {
                    if (initialPrompt) {
                        playGreeting(initialPrompt);
                    } else {
                        setPipelineStatus('Starting mic...');
                        startListeningWithRetry();
                    }
                }, 2500);

                // Last-resort force-start: if listening hasn't started within 8s, force it.
                // Does NOT check isSpeakingRef — this is the safety net when everything else fails.
                setTimeout(() => {
                    if (!isRecognitionActiveRef.current && handsFreeModeRef.current) {
                        console.warn('[Pipeline] ⚠️ Listening not active after 8s — force-starting');
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                        setPipelineStatus('Force-starting mic...');
                        startListeningWithRetry();
                    }
                }, 8000);
            }
        } else {
            // Audio-only mode — no Simli
            setIsAudioOnlyMode(true);
            setIsLoading(false);
            setPipelineStatus('Voice mode active');
            if (initialPrompt) {
                playGreeting(initialPrompt);
            } else {
                startListeningWithRetry();
            }
        }
    }, [onStart, initializeSimliClient, startListeningWithRetry, shouldUseSimli, initialPrompt, playGreeting]);

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

        // Fix C: Clear processing timeout
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
        }

        pendingAudioRef.current = [];

        // Release pre-acquired mic stream
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }

        setIsLoading(false);
        setIsAvatarVisible(false);
        setIsAudioOnlyMode(false);
        setIsListening(false);
        setError('');
        setIsProcessing(false);
        setTranscript('');
        setUserMessage('');
        setAiMessage('');
        setPipelineStatus('');
        setDeepgramState('idle');

        isRecognitionActiveRef.current = false;
        isSpeakingRef.current = false;
        simliClientRef.current = null;
        conversationIdRef.current = null;
        accumulatedTranscriptRef.current = '';
        onStop?.();
    }, [onStop, stopListening]);

    // Listen for startListening custom event (hands-free auto-restart)
    // When this event is dispatched, the caller has already decided listening should start.
    // We only guard on isRecognitionActiveRef (prevent double-start) and handsFreeModeRef.
    // isSpeakingRef is NOT checked here — callers must reset it before dispatching.
    useEffect(() => {
        const handleStartListening = () => {
            console.log('[STT] startListening event received', {
                handsFree: handsFreeModeRef.current,
                recognitionActive: isRecognitionActiveRef.current,
                speaking: isSpeakingRef.current,
            });
            if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                startListeningWithRetry();
            } else {
                console.log('[STT] startListening event BLOCKED — already active or hands-free off');
            }
        };

        document.addEventListener('startListening', handleStartListening);
        return () => {
            document.removeEventListener('startListening', handleStartListening);
        };
    }, [startListeningWithRetry]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            deepgramRef.current?.stop();
            simliClientRef.current?.close();
            simliReadyRef.current = false;
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
                micStreamRef.current = null;
            }
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            if (utteranceTimeoutRef.current) clearTimeout(utteranceTimeoutRef.current);
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
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

                {/* Live conversation display */}
                {isRunning && (
                    <div className="absolute bottom-4 left-4 right-4 space-y-2 max-h-[40%] overflow-y-auto">
                        {/* AI response */}
                        {aiMessage && (
                            <div className="p-3 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                                <p className="text-white/50 text-xs font-medium mb-1">AI</p>
                                <p className="text-white text-sm leading-relaxed">{aiMessage.length > 200 ? aiMessage.slice(0, 200) + '…' : aiMessage}</p>
                            </div>
                        )}
                        {/* User's sent message */}
                        {userMessage && !transcript && !isListening && (
                            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm">
                                <p className="text-blue-300/60 text-xs font-medium mb-1">You</p>
                                <p className="text-blue-100 text-sm">{userMessage}</p>
                            </div>
                        )}
                        {/* Live transcript while speaking */}
                        {transcript && (
                            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm animate-pulse">
                                <p className="text-blue-300/60 text-xs font-medium mb-1">You (listening...)</p>
                                <p className="text-blue-100 text-sm">{transcript}</p>
                            </div>
                        )}
                        {/* Processing indicator */}
                        {isProcessing && !aiMessage && (
                            <div className="p-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-2">
                                <Loader2 className="w-3 h-3 text-white/60 animate-spin" />
                                <p className="text-white/60 text-xs">Thinking...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Pipeline status indicator (Fix A) — shows where in the pipeline we are */}
                {isRunning && pipelineStatus && (
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-center">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm ${
                            pipelineStatus.includes('Error') || pipelineStatus.includes('unavailable') || pipelineStatus.includes('failed')
                                ? 'bg-red-500/20 border border-red-500/50'
                                : pipelineStatus.includes('Listening')
                                    ? 'bg-green-500/20 border border-green-500/50'
                                    : 'bg-white/10 border border-white/20'
                        }`}>
                            {pipelineStatus.includes('Listening') ? (
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            ) : pipelineStatus.includes('Error') || pipelineStatus.includes('unavailable') ? (
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                            ) : (
                                <Loader2 className="w-3 h-3 text-white/60 animate-spin" />
                            )}
                            <span className={`text-xs ${
                                pipelineStatus.includes('Error') || pipelineStatus.includes('unavailable') || pipelineStatus.includes('failed')
                                    ? 'text-red-400'
                                    : pipelineStatus.includes('Listening')
                                        ? 'text-green-400'
                                        : 'text-white/80'
                            }`}>{pipelineStatus}</span>
                        </div>
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
