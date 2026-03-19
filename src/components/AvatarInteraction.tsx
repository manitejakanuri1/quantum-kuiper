'use client';

/**
 * AvatarInteraction Component — Text-Input Conversation with Lip-Sync Avatar
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
 * Flow:
 * 1. User types a message in text input
 * 2. POST /api/agents/[id]/converse → RAG + Gemini → answer text
 * 3. POST /api/tts → Fish Audio → MP3 audio
 * 4. Decode MP3 → PCM16 (16kHz mono) → Simli.sendAudioData() → lip-synced output
 * 5. Simli emits 'silent' → ready for next message
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient, generateIceServers } from 'simli-client';
import { Loader2, User, Send } from 'lucide-react';
import Image from 'next/image';
import { API_ROUTES } from '@/lib/api-routes';

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
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAudioOnlyMode, setIsAudioOnlyMode] = useState(false); // Fallback mode

    // Pipeline status indicator — shows exactly where in the pipeline we are
    const [pipelineStatus, setPipelineStatus] = useState('');

    // Chat messages visible on screen
    const [userMessage, setUserMessage] = useState('');    // What user said
    const [aiMessage, setAiMessage] = useState('');        // What AI replied
    const [textInput, setTextInput] = useState('');         // Text input field
    const textInputRef = useRef<HTMLInputElement>(null);

    // Simli refs — video + audio are Simli's WebRTC output (synced lip-sync + voice)
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    // Fallback audio element — ONLY used when Simli is unavailable
    const fallbackAudioRef = useRef<HTMLAudioElement>(null);
    const simliClientRef = useRef<SimliClient | null>(null);
    const simliReadyRef = useRef<boolean>(false); // True when Simli has sent "connected" + sessionInitialized

    // Conversation state
    const conversationIdRef = useRef<string | null>(null);
    const isSpeakingRef = useRef<boolean>(false);

    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Audio buffer — accumulate PCM16 data before Simli is ready
    const pendingAudioRef = useRef<Uint8Array[]>([]);

    // Safety timeout ref (30s max)
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Simli reconnect guard — prevent infinite WebRTC reconnect loop
    const simliConnectAttemptsRef = useRef<number>(0);
    const simliGaveUpRef = useRef<boolean>(false);
    const MAX_SIMLI_CONNECT_ATTEMPTS = 3;
    const isSimliConnectingRef = useRef<boolean>(false);
    const simliBackoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Store Simli event handler refs for proper cleanup via off()
    const simliHandlersRef = useRef<{
        onStart: (() => void) | null;
        onStop: (() => void) | null;
        onError: ((detail: string) => void) | null;
        onStartupError: ((message: string) => void) | null;
        onSpeaking: (() => void) | null;
        onSilent: (() => void) | null;
    }>({ onStart: null, onStop: null, onError: null, onStartupError: null, onSpeaking: null, onSilent: null });

    // Ref to always hold the latest sendMessage (prevents stale closures)
    const sendMessageRef = useRef<(text: string) => void>(() => {});

    // Whether we should try Simli at all
    const shouldUseSimli = avatarEnabled && !!simli_faceid;

    // ─── Helper: Remove all our Simli event handlers ───
    const removeSimliHandlers = useCallback((client: SimliClient) => {
        const h = simliHandlersRef.current;
        if (h.onStart) client.off('start', h.onStart);
        if (h.onStop) client.off('stop', h.onStop);
        if (h.onError) client.off('error', h.onError);
        if (h.onStartupError) client.off('startup_error', h.onStartupError);
        if (h.onSpeaking) client.off('speaking', h.onSpeaking);
        if (h.onSilent) client.off('silent', h.onSilent);
        simliHandlersRef.current = { onStart: null, onStop: null, onError: null, onStartupError: null, onSpeaking: null, onSilent: null };
    }, []);

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

    // ─── Focus text input (used after speech finishes) ───
    const focusTextInput = useCallback(() => {
        setPipelineStatus('Type a message...');
        setTimeout(() => textInputRef.current?.focus(), 100);
    }, []);

    // ─── Initialize Simli client ───
    const initializeSimliClient = useCallback(async (): Promise<boolean> => {
        if (!shouldUseSimli) return false;

        console.log('=== Simli Initialization ===');
        console.log('Face ID:', simli_faceid);
        simliConnectAttemptsRef.current = 0; // Reset counter for fresh init
        simliGaveUpRef.current = false;

        if (!videoRef.current || !audioRef.current) {
            console.error('[Simli] Video/Audio elements not ready');
            setError('Video element not ready. Please try again.');
            setIsLoading(false);
            return false;
        }

        try {
            // Fetch session token from server (API key stays server-side)
            console.log(`[Simli] 🔑 Fetching ${API_ROUTES.simliToken}...`);
            const tokenRes = await fetch(API_ROUTES.simliToken, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceId: simli_faceid, agentId }),
            });

            if (!tokenRes.ok) {
                throw new Error('Failed to get Simli session token');
            }

            const { sessionToken, iceServers } = await tokenRes.json();

            // v3 API: constructor(session_token, videoEl, audioEl, iceServers, logLevel, transport_mode)
            // Use ICE servers from server (API key stays server-side) for P2P,
            // fall back to livekit if ICE servers unavailable
            const hasIceServers = Array.isArray(iceServers) && iceServers.length > 0;
            const simliClient = new SimliClient(
                sessionToken,
                videoRef.current,
                audioRef.current,
                hasIceServers ? iceServers : null,
                undefined, // logLevel
                hasIceServers ? "p2p" : "livekit"
            );

            // ─── Simli v3 Events (store refs for proper off() cleanup) ───

            const onStart = () => {
                // Guard: if we already gave up, ignore spurious start events
                if (simliGaveUpRef.current) return;

                console.log('[Simli] ✅ Connected — session initialized');
                simliConnectAttemptsRef.current = 0; // Reset on successful connection
                simliReadyRef.current = true;
                setIsAvatarVisible(true);
                setIsLoading(false);
                setPipelineStatus('Avatar ready');

                // Send initial silence to keep connection alive (required by Simli)
                const silence = new Uint8Array(6000).fill(0);
                simliClient.sendAudioData(silence);

                // Flush any audio that was buffered while waiting for connection
                flushPendingAudio();
            };

            const onStop = () => {
                // Guard: if we already gave up, ignore all further stop events
                if (simliGaveUpRef.current) return;
                // Guard: if we're already handling a reconnect, ignore duplicate stops
                if (isSimliConnectingRef.current) return;

                // IMMEDIATELY stop the dying client
                const dyingClient = simliClientRef.current;
                simliClientRef.current = null;
                simliReadyRef.current = false;
                setIsAvatarVisible(false);

                if (dyingClient) {
                    removeSimliHandlers(dyingClient);
                    try { dyingClient.stop(); } catch { /* ignore */ }
                }

                simliConnectAttemptsRef.current += 1;
                const attempt = simliConnectAttemptsRef.current;
                console.log(`[Simli] Disconnected (attempt ${attempt}/${MAX_SIMLI_CONNECT_ATTEMPTS})`);

                // Stop after max attempts — fall back to audio-only
                if (attempt >= MAX_SIMLI_CONNECT_ATTEMPTS) {
                    simliGaveUpRef.current = true;
                    console.warn('[Simli] Max reconnect attempts reached — falling back to audio-only');
                    pendingAudioRef.current = [];
                    setIsAudioOnlyMode(true);
                    setIsLoading(false);
                    setError('Avatar unavailable. Using voice-only mode.');
                    return;
                }

                // Exponential backoff: 2s, 4s, 8s...
                const backoffMs = 2000 * Math.pow(2, attempt - 1);
                console.log(`[Simli] Retrying in ${backoffMs}ms...`);
                isSimliConnectingRef.current = true;
                setPipelineStatus(`Reconnecting avatar (${attempt}/${MAX_SIMLI_CONNECT_ATTEMPTS})...`);

                simliBackoffTimeoutRef.current = setTimeout(async () => {
                    try {
                        // Re-fetch session token for fresh connection
                        const retryTokenRes = await fetch(API_ROUTES.simliToken, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ faceId: simli_faceid, agentId }),
                        });
                        if (!retryTokenRes.ok) throw new Error('Token fetch failed on retry');
                        const { sessionToken: retryToken, iceServers: retryIce } = await retryTokenRes.json();

                        if (!videoRef.current || !audioRef.current) throw new Error('Video/Audio refs lost');

                        // v3: constructor-based init with ICE servers from server
                        const hasRetryIce = Array.isArray(retryIce) && retryIce.length > 0;
                        const newClient = new SimliClient(
                            retryToken,
                            videoRef.current,
                            audioRef.current,
                            hasRetryIce ? retryIce : null,
                            undefined,
                            hasRetryIce ? "p2p" : "livekit"
                        );

                        // Re-attach the same handler functions (they close over refs)
                        simliHandlersRef.current = {
                            onStart, onStop, onError, onStartupError, onSpeaking, onSilent
                        };
                        newClient.on('start', onStart);
                        newClient.on('stop', onStop);
                        newClient.on('error', onError);
                        newClient.on('startup_error', onStartupError);
                        newClient.on('speaking', onSpeaking);
                        newClient.on('silent', onSilent);

                        simliClientRef.current = newClient;
                        await newClient.start();
                    } catch (err) {
                        console.error('[Simli] Retry failed:', err);
                        simliGaveUpRef.current = true;
                        pendingAudioRef.current = [];
                        setIsAudioOnlyMode(true);
                        setIsLoading(false);
                        setError('Avatar unavailable. Using voice-only mode.');
                    } finally {
                        isSimliConnectingRef.current = false;
                    }
                }, backoffMs);
            };

            const onError = (detail: string) => {
                if (simliGaveUpRef.current) return;
                if (isSimliConnectingRef.current) return;
                console.warn('[Simli] Error:', detail, '— falling back to audio-only');
                simliGaveUpRef.current = true;

                const clientToClose = simliClientRef.current;
                simliClientRef.current = null;
                simliReadyRef.current = false;
                pendingAudioRef.current = [];

                if (clientToClose) {
                    removeSimliHandlers(clientToClose);
                    try { clientToClose.stop(); } catch { /* ignore */ }
                }

                setIsAudioOnlyMode(true);
                setIsLoading(false);
                setError('Avatar unavailable. Using voice-only mode.');
            };

            const onStartupError = (message: string) => {
                console.warn('[Simli] Startup error:', message);
                onError(message);
            };

            // Simli emits 'speaking' when it starts playing the lip-synced audio+video
            const onSpeaking = () => {
                if (simliGaveUpRef.current) return;
                console.log('[Simli] 🗣️ Speaking (lip-sync active)');
                isSpeakingRef.current = true;
            };

            // Simli emits 'silent' when it finishes — ready for next message
            const onSilent = () => {
                if (simliGaveUpRef.current) return;
                console.log('[Simli] 🤫 Silent (lip-sync done)');
                isSpeakingRef.current = false;

                // Clear safety timeout since Simli told us it's done
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
                }

                // Focus text input for next message
                focusTextInput();
            };

            // Store handler references for off() cleanup
            simliHandlersRef.current = { onStart, onStop, onError, onStartupError, onSpeaking, onSilent };

            simliClient.on('start', onStart);
            simliClient.on('stop', onStop);
            simliClient.on('error', onError);
            simliClient.on('startup_error', onStartupError);
            simliClient.on('speaking', onSpeaking);
            simliClient.on('silent', onSilent);

            simliClientRef.current = simliClient;
            await simliClient.start();
            return true;
        } catch (err) {
            console.error('[Simli] Initialization failed:', err);
            setIsAudioOnlyMode(true);
            setIsLoading(false);
            setError('Avatar unavailable. Using voice-only mode.');
            return false;
        }
    }, [simli_faceid, shouldUseSimli, flushPendingAudio, agentId, removeSimliHandlers, focusTextInput]);

    /**
     * Core conversation function — the heart of the pipeline
     *
     * AUDIO FLOW:
     * 1. POST query to /api/agents/[id]/converse → answer text
     * 2. POST answer to /api/tts → MP3 audio from Fish Audio
     * 3. SIMLI MODE: Decode MP3 → PCM16 → sendAudioData() → Simli renders lip-sync
     *    → User hears audio FROM Simli's WebRTC <audio> element (synced with video)
     *    FALLBACK MODE: Play MP3 directly through fallbackAudioRef
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

        // Guard: ensure agentId is defined before making API call
        if (!agentId) {
            console.error('[Converse] ❌ agentId is undefined — cannot call converse API');
            return;
        }

        console.log(`[Converse] ✅ User said: "${text}" — sending to backend`);
        setIsProcessing(true);
        isSpeakingRef.current = true;
        setUserMessage(text);
        setAiMessage('');  // Clear previous AI reply
        setPipelineStatus('Thinking...');
        onTranscript?.(text);

        // Safety timeout — if isProcessing stays true for 30s, force reset
        if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = setTimeout(() => {
            console.warn('[Converse] ⚠️ isProcessing timeout (30s) — force resetting');
            setIsProcessing(false);
            isSpeakingRef.current = false;
            setPipelineStatus('Timeout — restarting...');
            focusTextInput();
        }, 30000);

        // Clear any pending restart timeout
        if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = null;
        }

        let answer = '';
        try {
            // ── Step 1: Get answer from RAG pipeline ──
            setPipelineStatus('Getting AI response...');
            const converseUrl = API_ROUTES.agentConverse(agentId);
            console.log(`[Converse] 📡 Fetching ${converseUrl}...`);
            const converseResponse = await fetch(converseUrl, {
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
            answer = data.answer;
            conversationIdRef.current = data.conversationId;
            // Don't show text yet — wait until audio starts playing to keep them in sync

            console.log(`[Converse] ✅ Answer: "${answer.slice(0, 80)}..."`);
            console.log(`[Converse] Retrieval: ${data.retrievalTimeMs}ms, Generation: ${data.generationTimeMs}ms`);

            // ── Step 2: Convert answer to audio via Fish Audio TTS ──
            setPipelineStatus('Generating speech...');
            console.log(`[Converse] 🔊 Fetching ${API_ROUTES.tts}...`);
            const ttsResponse = await fetch(API_ROUTES.tts, {
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
                setAiMessage(answer);  // Show text synced with audio start
                setPipelineStatus('Speaking...');

                setIsProcessing(false);
                if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }

                // Simli's 'silent' event will focus text input (see event handler above).
                // Safety fallback: if Simli doesn't emit 'silent' within expected time,
                // focus text input anyway to prevent getting stuck.
                restartTimeoutRef.current = setTimeout(() => {
                    console.log('[Converse] Safety timeout — focusing text input');
                    isSpeakingRef.current = false;
                    focusTextInput();
                }, durationMs + 3000); // audio duration + 3s buffer

            } else {
                // ═══════════════════════════════════════════════
                // AUDIO-ONLY FALLBACK — Play MP3 directly
                // Used when Simli is unavailable or disabled
                // ═══════════════════════════════════════════════

                console.log('[Converse] Playing audio directly (audio-only fallback)');
                setAiMessage(answer);  // Show text synced with audio start
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
                        focusTextInput();
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
            if (answer) setAiMessage(answer);  // Still show text if TTS failed
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setPipelineStatus('Error — retrying...');
            setIsProcessing(false);
            isSpeakingRef.current = false;
            if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }

            // Focus text input so user can try again
            setTimeout(() => focusTextInput(), 1000);
        }
    }, [agentId, voiceId, onTranscript, isProcessing, isAvatarVisible, isAudioOnlyMode, sendAudioToSimli, focusTextInput]);

    // Keep sendMessageRef always pointing to the latest sendMessage
    sendMessageRef.current = sendMessage;

    /**
     * Play greeting message through TTS when session starts.
     * Routes through Simli (if active) or fallback audio, then focuses text input.
     */
    const playGreeting = useCallback(async (greetingText: string) => {
        if (!greetingText.trim()) return;

        console.log(`[Greeting] Playing: "${greetingText}"`);
        isSpeakingRef.current = true;
        setIsProcessing(true);
        setPipelineStatus('Playing greeting...');

        try {
            // Convert greeting to audio via Fish Audio TTS
            console.log(`[Greeting] 🔊 Fetching ${API_ROUTES.tts}...`);
            const ttsResponse = await fetch(API_ROUTES.tts, {
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

                // Focus text input after greeting finishes
                restartTimeoutRef.current = setTimeout(() => {
                    console.log('[Greeting] Safety restart — focusing text input after greeting');
                    isSpeakingRef.current = false;
                    setIsProcessing(false);
                    focusTextInput();
                }, durationMs + 2000);
            } else {
                // Audio-only fallback
                const blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);

                if (fallbackAudioRef.current) {
                    fallbackAudioRef.current.src = url;

                    // Backup timeout in case onended never fires
                    const fallbackDuration = (mp3Buffer.byteLength / 16000) * 1000;
                    const fallbackTimeout = setTimeout(() => {
                        console.log('[Greeting] Fallback backup timeout — focusing text input');
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                        focusTextInput();
                    }, fallbackDuration + 5000);

                    fallbackAudioRef.current.onended = () => {
                        clearTimeout(fallbackTimeout);
                        URL.revokeObjectURL(url);
                        isSpeakingRef.current = false;
                        setIsProcessing(false);
                        focusTextInput();
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
            setPipelineStatus('Greeting failed — ready for input...');
            setTimeout(() => focusTextInput(), 500);
        }
    }, [voiceId, isAvatarVisible, isAudioOnlyMode, sendAudioToSimli, focusTextInput]);

    // Handle start button click
    const handleStart = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setIsAudioOnlyMode(false);
        setPipelineStatus('Connecting...');
        conversationIdRef.current = null;
        simliReadyRef.current = false;
        pendingAudioRef.current = [];
        onStart?.();

        if (shouldUseSimli) {
            setPipelineStatus('Connecting to avatar...');
            const simliStarted = await initializeSimliClient();
            if (!simliStarted) {
                // Simli init failed immediately — start audio-only
                setIsAudioOnlyMode(true);
                setIsLoading(false);
                setPipelineStatus('Type a message...');
                if (initialPrompt) {
                    playGreeting(initialPrompt);
                } else {
                    focusTextInput();
                }
            } else {
                // Wait for Simli to actually connect before playing greeting
                setPipelineStatus('Waiting for avatar...');
                let greetingFired = false;
                const fireGreeting = () => {
                    if (greetingFired) return;
                    greetingFired = true;
                    if (initialPrompt) {
                        playGreeting(initialPrompt);
                    } else {
                        focusTextInput();
                    }
                };

                // Poll every 500ms for Simli readiness
                const greetingPoll = setInterval(() => {
                    if (simliReadyRef.current || simliGaveUpRef.current || isAudioOnlyMode) {
                        clearInterval(greetingPoll);
                        fireGreeting();
                    }
                }, 500);

                // Hard timeout: proceed after 7s regardless
                setTimeout(() => {
                    clearInterval(greetingPoll);
                    if (!greetingFired) {
                        console.warn('[Simli] Greeting timeout — proceeding without waiting for avatar');
                    }
                    fireGreeting();
                }, 7000);
            }
        } else {
            // Audio-only mode — no Simli
            setIsAudioOnlyMode(true);
            setIsLoading(false);
            setPipelineStatus('Type a message...');
            if (initialPrompt) {
                playGreeting(initialPrompt);
            } else {
                focusTextInput();
            }
        }
    }, [onStart, initializeSimliClient, shouldUseSimli, initialPrompt, playGreeting, focusTextInput]);

    // Handle stop button click
    const handleStop = useCallback(() => {
        // Close Simli connection (guard against CONNECTING state crash)
        if (simliClientRef.current) {
            const clientToClose = simliClientRef.current;
            simliClientRef.current = null;
            simliGaveUpRef.current = true;
            removeSimliHandlers(clientToClose);
            try { clientToClose.stop(); } catch { /* ignore stop-while-connecting */ }
        }
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

        // Clear processing timeout
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
        }

        // Clear backoff timeout
        if (simliBackoffTimeoutRef.current) {
            clearTimeout(simliBackoffTimeoutRef.current);
            simliBackoffTimeoutRef.current = null;
        }
        isSimliConnectingRef.current = false;

        pendingAudioRef.current = [];

        setIsLoading(false);
        setIsAvatarVisible(false);
        setIsAudioOnlyMode(false);
        setError('');
        setIsProcessing(false);
        setUserMessage('');
        setAiMessage('');
        setPipelineStatus('');

        isSpeakingRef.current = false;
        conversationIdRef.current = null;
        onStop?.();
    }, [onStop, removeSimliHandlers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (simliClientRef.current) {
                const clientToClose = simliClientRef.current;
                simliClientRef.current = null;
                removeSimliHandlers(clientToClose);
                try { clientToClose.stop(); } catch { /* ignore stop-while-connecting */ }
            }
            simliReadyRef.current = false;
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            if (simliBackoffTimeoutRef.current) clearTimeout(simliBackoffTimeoutRef.current);
            isSimliConnectingRef.current = false;
        };
    }, [removeSimliHandlers]);

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
            <div className="relative aspect-square bg-bg-surface rounded-2xl overflow-hidden">
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
                    <div className="absolute inset-0 flex items-center justify-center bg-bg-surface/80">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-text-primary animate-spin" />
                            <p className="text-text-primary text-sm">
                                {shouldUseSimli ? 'Connecting to avatar...' : 'Starting...'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Audio-only mode visualization */}
                {isAudioOnlyMode && !isAvatarVisible && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${
                                isProcessing
                                    ? 'bg-orange-500/20 ring-4 ring-orange-500/30'
                                    : 'bg-white/10'
                            }`}>
                                <User className={`w-10 h-10 ${
                                    isProcessing ? 'text-orange-400' : 'text-white/60'
                                }`} />
                            </div>
                            <p className="text-text-secondary text-sm">
                                {isProcessing ? 'Thinking...' : 'Voice mode active'}
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
                                <div className="absolute inset-0 bg-gradient-to-t from-bg-surface/80 via-transparent to-bg-surface/30" />
                                <div className="absolute bottom-8 left-0 right-0 text-center">
                                    <p className="text-white/90 text-lg font-medium">Click Start to begin</p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <div className="w-24 h-24 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center">
                                    <User className="w-12 h-12 text-text-primary" />
                                </div>
                                <p className="text-text-secondary">Click Start to begin</p>
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
                                <p className="text-text-primary text-sm leading-relaxed">{aiMessage.length > 200 ? aiMessage.slice(0, 200) + '…' : aiMessage}</p>
                            </div>
                        )}
                        {/* User's sent message */}
                        {userMessage && (
                            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm">
                                <p className="text-blue-300/60 text-xs font-medium mb-1">You</p>
                                <p className="text-blue-100 text-sm">{userMessage}</p>
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

                {/* Pipeline status indicator — shows where in the pipeline we are */}
                {isRunning && pipelineStatus && (
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-center">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm ${
                            pipelineStatus.includes('Error') || pipelineStatus.includes('unavailable') || pipelineStatus.includes('failed')
                                ? 'bg-red-500/20 border border-red-500/50'
                                : pipelineStatus.includes('Type')
                                    ? 'bg-green-500/20 border border-green-500/50'
                                    : 'bg-white/10 border border-white/20'
                        }`}>
                            {pipelineStatus.includes('Type') ? (
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            ) : pipelineStatus.includes('Error') || pipelineStatus.includes('unavailable') ? (
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                            ) : (
                                <Loader2 className="w-3 h-3 text-white/60 animate-spin" />
                            )}
                            <span className={`text-xs ${
                                pipelineStatus.includes('Error') || pipelineStatus.includes('unavailable') || pipelineStatus.includes('failed')
                                    ? 'text-red-400'
                                    : pipelineStatus.includes('Type')
                                        ? 'text-green-400'
                                        : 'text-white/80'
                            }`}>{pipelineStatus}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Text input */}
            {isRunning && (
                <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const text = textInput.trim();
                        if (!text || isProcessing) return;
                        setTextInput('');
                        sendMessageRef.current(text);
                    }}
                >
                    <input
                        ref={textInputRef}
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={isProcessing}
                        className="flex-1 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-text-primary placeholder-white/40 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!textInput.trim() || isProcessing}
                        className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Send message"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            )}

            {/* Controls */}
            <div className="mt-4 flex justify-center">
                {!isRunning ? (
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="w-full py-3 px-6 rounded-xl bg-[#1a1a1a] border border-white/10 hover:bg-[#252525] text-text-primary font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
