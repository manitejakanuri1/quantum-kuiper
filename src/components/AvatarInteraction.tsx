'use client';

/**
 * AvatarInteraction Component - Based on create-simli-app
 * https://github.com/simliai/create-simli-app
 * 
 * Real-time video avatar with:
 * - SimliClient for WebRTC video
 * - WebSocket for audio streaming  
 * - Web Speech API for speech-to-text
 * - Text input fallback
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';
import { Loader2, Mic, MicOff, VideoOff, User, Send, Headphones } from 'lucide-react';
import Image from 'next/image';
import { DeepgramSTT, isDeepgramConfigured } from '@/lib/deepgram';

// Web Speech API types (not in standard TypeScript lib)
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}


type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface AvatarInteractionProps {
    simli_faceid: string;
    voiceId: string;
    initialPrompt?: string;
    apiKey: string;
    facePreviewUrl?: string;
    agentName?: string;
    agentId?: string;  // For RAG queries
    onStart?: () => void;
    onStop?: () => void;
    onError?: (error: string) => void;
    onTranscript?: (text: string) => void;
    className?: string;
}

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
    simli_faceid,
    voiceId,
    initialPrompt = "You are a helpful assistant.",
    apiKey,
    facePreviewUrl,
    agentName = 'your assistant',
    agentId,
    onStart,
    onStop,
    onError,
    onTranscript,
    className = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isAvatarVisible, setIsAvatarVisible] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState('');
    const [textInput, setTextInput] = useState('');
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [handsFreeMode, setHandsFreeMode] = useState(true); // Enable hands-free by default

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const simliClientRef = useRef<SimliClient | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const deepgramRef = useRef<DeepgramSTT | null>(null);
    const isRecognitionActiveRef = useRef<boolean>(false);
    const handsFreeModeRef = useRef<boolean>(true); // Track hands-free mode in ref for callbacks

    // Initialize Simli client
    const initializeSimliClient = useCallback(() => {
        console.log('=== Simli Initialization ===');
        console.log('API Key:', apiKey ? `${apiKey.substring(0, 5)}...` : 'MISSING');
        console.log('Face ID:', simli_faceid);

        if (!videoRef.current || !audioRef.current) {
            console.warn('Video or audio ref not ready yet');
            setError('Video element not ready. Please try again.');
            setIsLoading(false);
            return false;
        }

        if (!apiKey) {
            console.error('Simli API key is missing!');
            setError('Simli API key is not configured.');
            setIsLoading(false);
            return false;
        }

        try {
            const simliClient = new SimliClient();

            simliClient.Initialize({
                apiKey: apiKey,
                faceID: simli_faceid,
                handleSilence: true,
                maxSessionLength: 200,
                maxIdleTime: 100,
                videoRef: videoRef.current,
                audioRef: audioRef.current,
            } as Parameters<typeof simliClient.Initialize>[0]);

            simliClient.on('connected', () => {
                console.log('✅ SimliClient connected!');
                setIsAvatarVisible(true);
                setIsLoading(false);
                const audioData = new Uint8Array(6000).fill(0);
                simliClient.sendAudioData(audioData);
            });

            simliClient.on('disconnected', () => {
                console.log('❌ SimliClient disconnected');
                setIsAvatarVisible(false);
            });

            simliClient.on('failed', (error: Error | string) => {
                console.error('❌ SimliClient failed:', error);
                setError('Failed to connect to Simli.');
                setIsLoading(false);
            });

            simliClientRef.current = simliClient;
            console.log('✅ Simli Client initialized');

            // Start the Simli client to begin WebRTC connection
            simliClient.start();
            console.log('🚀 Simli Client started');

            return true;
        } catch (err) {
            console.error('Failed to initialize Simli client:', err);
            setError('Failed to initialize avatar.');
            setIsLoading(false);
            return false;
        }
    }, [apiKey, simli_faceid]);

    // Send message to backend
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            console.log('Cannot send message - WebSocket not ready');
            return;
        }

        setIsProcessing(true);
        onTranscript?.(text);

        socketRef.current.send(JSON.stringify({
            type: 'text',
            content: text
        }));
    }, [onTranscript]);

    // Track accumulated transcript for utterance end handling
    const accumulatedTranscriptRef = useRef<string>('');
    const utteranceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Deepgram STT
    const initializeDeepgram = useCallback(() => {
        if (!isDeepgramConfigured()) {
            console.warn('Deepgram API key not configured');
            return null;
        }

        const deepgram = new DeepgramSTT({
            onTranscript: (transcript) => {
                setTranscript(transcript.text);

                // Clear previous timeout
                if (utteranceTimeoutRef.current) {
                    clearTimeout(utteranceTimeoutRef.current);
                }

                if (transcript.isFinal && transcript.text.trim()) {
                    console.log('Final transcript:', transcript.text);
                    sendMessage(transcript.text);
                    setTranscript('');
                    accumulatedTranscriptRef.current = '';
                } else if (transcript.text.trim()) {
                    // Track accumulated text for fallback
                    accumulatedTranscriptRef.current = transcript.text;

                    // Fallback: if no final transcript after 2s of no updates, send it
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
            onError: (error) => {
                console.error('Deepgram error:', error);
                isRecognitionActiveRef.current = false;
                setIsListening(false);
            },
            onClose: () => {
                console.log('Deepgram disconnected');
                // Send any remaining transcript before closing
                if (accumulatedTranscriptRef.current.trim()) {
                    console.log('Sending final transcript on close:', accumulatedTranscriptRef.current);
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



    // Initialize WebSocket connection to backend
    const initializeWebSocket = useCallback((connectionId: string) => {
        // Use configurable backend URL from environment, fallback to localhost
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'ws://localhost:8080';
        const wsUrl = `${BACKEND_URL}/ws?connectionId=${connectionId}`;
        console.log('Connecting to WebSocket:', wsUrl);
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
            console.log('✅ Connected to conversation server');
        };

        socketRef.current.onmessage = (event) => {
            if (event.data instanceof Blob) {
                // Audio data from TTS - send to Simli for lip sync
                event.data.arrayBuffer().then((arrayBuffer) => {
                    const uint8Array = new Uint8Array(arrayBuffer);
                    console.log('Received audio data, sending to Simli:', uint8Array.length);
                    simliClientRef.current?.sendAudioData(uint8Array);
                });
            } else {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'text') {
                        console.log('AI Response:', message.content);
                        setAiResponse(message.content);
                        setIsProcessing(false);
                    } else if (message.type === 'tts_complete' || message.type === 'audio_complete') {
                        // TTS finished - auto-restart listening in hands-free mode
                        console.log('TTS complete, hands-free mode:', handsFreeModeRef.current);
                        if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                            // Small delay to ensure audio playback is fully complete
                            setTimeout(() => {
                                if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
                                    console.log('Auto-starting listening (hands-free mode)');
                                    // Trigger startListening via a custom event or direct call
                                    const startEvent = new CustomEvent('startListening');
                                    document.dispatchEvent(startEvent);
                                }
                            }, 500);
                        }
                    } else if (message.type === 'interrupt') {
                        simliClientRef.current?.ClearBuffer();
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            }
        };

        socketRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            setError('Connection error. Is the backend server running on port 8080?');
        };

        socketRef.current.onclose = () => {
            console.log('WebSocket closed');
        };
    }, []);

    // Start conversation with backend
    const startConversation = useCallback(async () => {
        try {
            console.log('Starting conversation...');
            const response = await fetch('http://localhost:8080/start-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: initialPrompt,
                    voiceId: voiceId,
                    faceId: simli_faceid,
                    agentName: agentName,
                    agentId: agentId  // Pass agentId for RAG queries
                })
            });

            if (!response.ok) {
                throw new Error('Failed to start conversation');
            }

            const data = await response.json();
            console.log('Conversation started:', data.connectionId);
            initializeWebSocket(data.connectionId);
            return true;
        } catch (error) {
            console.error('Failed to start conversation:', error);
            setError('Failed to connect to server. Make sure the backend is running on port 8080.');
            return false;
        }
    }, [initialPrompt, voiceId, simli_faceid, agentName, agentId, initializeWebSocket]);

    // Start listening (used by hands-free mode)
    const startListening = useCallback(async () => {
        if (isRecognitionActiveRef.current || isListening) {
            return; // Already listening
        }

        // Create a fresh Deepgram instance
        deepgramRef.current = initializeDeepgram();

        if (!deepgramRef.current) {
            console.warn('Deepgram not available - check API key');
            return;
        }

        try {
            await deepgramRef.current.start();
            isRecognitionActiveRef.current = true;
            setIsListening(true);
            console.log('Deepgram STT started (hands-free)');
        } catch (err) {
            console.error('Failed to start Deepgram:', err);
            isRecognitionActiveRef.current = false;
            setIsListening(false);
        }
    }, [isListening, initializeDeepgram]);

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
        onStart?.();

        initializeSimliClient();

        // Start conversation after a delay to let Simli connect
        setTimeout(async () => {
            const success = await startConversation();
            if (success) {
                // Auto-start listening for hands-free mode
                setTimeout(() => {
                    startListening();
                }, 1500);
            } else {
                setIsLoading(false);
            }
        }, 1000);
    }, [onStart, initializeSimliClient, startConversation, startListening]);

    // Handle stop button click
    const handleStop = useCallback(() => {
        // Stop Deepgram
        deepgramRef.current?.stop();
        deepgramRef.current = null;

        simliClientRef.current?.close();
        socketRef.current?.close();

        setIsLoading(false);
        setIsAvatarVisible(false);
        setIsListening(false);
        setError('');
        setAiResponse('');

        isRecognitionActiveRef.current = false;
        simliClientRef.current = null;
        socketRef.current = null;
        onStop?.();
    }, [onStop]);

    // Toggle voice listening with Deepgram
    const toggleListening = useCallback(async () => {
        // Update ref to match state
        handsFreeModeRef.current = handsFreeMode;

        // If currently listening/active, stop it
        if (isListening || isRecognitionActiveRef.current) {
            stopListening();
            return;
        }

        await startListening();
    }, [isListening, handsFreeMode, startListening, stopListening]);

    // Handle text input submit
    const handleTextSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (textInput.trim()) {
            sendMessage(textInput);
            setTextInput('');
        }
    }, [textInput, sendMessage]);

    // Sync handsFreeModeRef with state
    useEffect(() => {
        handsFreeModeRef.current = handsFreeMode;
    }, [handsFreeMode]);

    // Listen for startListening event (from hands-free mode)
    useEffect(() => {
        const handleStartListening = () => {
            if (handsFreeModeRef.current && !isRecognitionActiveRef.current) {
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
            socketRef.current?.close();
        };
    }, []);

    return (
        <div className={`relative ${className}`}>
            {/* Error display */}
            {error && (
                <div className="absolute top-4 left-4 right-4 z-10 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {/* Video container */}
            <div className="relative aspect-square bg-slate-900 rounded-2xl overflow-hidden">
                {/* Hidden video/audio elements */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 w-full h-full object-cover ${isAvatarVisible ? '' : 'hidden'}`}
                />
                <audio ref={audioRef} autoPlay />

                {/* Loading overlay */}
                {isLoading && !isAvatarVisible && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                            <p className="text-white text-sm">Connecting to avatar...</p>
                        </div>
                    </div>
                )}

                {/* Placeholder when not active */}
                {!isLoading && !isAvatarVisible && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {facePreviewUrl ? (
                            <>
                                <Image
                                    src={facePreviewUrl}
                                    alt="Agent face"
                                    fill
                                    className="object-cover"
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

                {/* Listening indicator */}
                {isListening && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-xs">Listening...</span>
                    </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                        <span className="text-white text-xs">Thinking...</span>
                    </div>
                )}
            </div>

            {/* Minimal controls - just close button */}
            <div className="mt-4 flex justify-center">
                {!isAvatarVisible ? (
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
