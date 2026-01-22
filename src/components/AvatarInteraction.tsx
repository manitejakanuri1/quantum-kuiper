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
import { Loader2, Mic, MicOff, VideoOff, User, Send } from 'lucide-react';
import Image from 'next/image';

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

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const simliClientRef = useRef<SimliClient | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const isRecognitionActiveRef = useRef<boolean>(false);

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

    // Initialize Web Speech API
    const initializeSpeechRecognition = useCallback(() => {

        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition as SpeechRecognitionConstructor | undefined;

        if (!SpeechRecognitionAPI) {
            console.warn('Speech recognition not supported');
            return null;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript;
            setTranscript(text);

            if (event.results[last].isFinal) {
                console.log('Final transcript:', text);
                sendMessage(text);
                setTranscript('');
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // Handle specific error types gracefully
            const errorType = event.error;

            // 'no-speech' occurs when user doesn't speak - not a real error
            // 'aborted' occurs when recognition is programmatically stopped
            // 'network' can occur with connectivity issues
            if (errorType === 'no-speech') {
                console.log('No speech detected - recognition will restart when you click Speak again');
            } else if (errorType === 'aborted') {
                console.log('Speech recognition aborted');
            } else {
                console.error('Speech recognition error:', errorType);
            }

            isRecognitionActiveRef.current = false;
            setIsListening(false);
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            isRecognitionActiveRef.current = false;
            setIsListening(false);
        };

        return recognition;
    }, [sendMessage]);



    // Initialize WebSocket connection to backend
    const initializeWebSocket = useCallback((connectionId: string) => {
        const wsUrl = `ws://localhost:8080/ws?connectionId=${connectionId}`;
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

    // Handle start button click
    const handleStart = useCallback(async () => {
        setIsLoading(true);
        setError('');
        onStart?.();

        initializeSimliClient();
        recognitionRef.current = initializeSpeechRecognition();

        // Start conversation after a delay to let Simli connect
        setTimeout(async () => {
            const success = await startConversation();
            if (!success) {
                setIsLoading(false);
            }
        }, 1000);
    }, [onStart, initializeSimliClient, initializeSpeechRecognition, startConversation]);

    // Handle stop button click
    const handleStop = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {
                // Ignore errors when stopping
            }
        }
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
        recognitionRef.current = null;
        onStop?.();
    }, [onStop]);

    // Toggle voice listening
    const toggleListening = useCallback(() => {
        // If currently listening/active, stop it
        if (isListening || isRecognitionActiveRef.current) {
            try {
                recognitionRef.current?.stop();
            } catch {
                // Ignore errors when stopping
            }
            isRecognitionActiveRef.current = false;
            setIsListening(false);
            return;
        }

        // Create a fresh recognition instance to avoid InvalidStateError
        recognitionRef.current = initializeSpeechRecognition();

        if (!recognitionRef.current) {
            console.warn('Speech recognition not available');
            return;
        }

        try {
            recognitionRef.current.start();
            isRecognitionActiveRef.current = true;
            setIsListening(true);
            console.log('Speech recognition started');
        } catch (err) {
            console.error('Failed to start speech recognition:', err);
            isRecognitionActiveRef.current = false;
            setIsListening(false);
        }
    }, [isListening, initializeSpeechRecognition]);

    // Handle text input submit
    const handleTextSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (textInput.trim()) {
            sendMessage(textInput);
            setTextInput('');
        }
    }, [textInput, sendMessage]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
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

            {/* AI Response display */}
            {aiResponse && isAvatarVisible && (
                <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-white/10">
                    <p className="text-white text-sm">{aiResponse}</p>
                </div>
            )}

            {/* Controls */}
            <div className="mt-4">
                {!isAvatarVisible ? (
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="w-full py-3 px-6 rounded-xl bg-[#1a1a1a] border border-white/10 hover:bg-[#252525] text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Connecting...' : 'Start Interaction'}
                    </button>
                ) : (
                    <div className="space-y-3">
                        {/* Voice/Stop controls */}
                        <div className="flex gap-3">
                            <button
                                onClick={toggleListening}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${isListening
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                                    }`}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                {isListening ? 'Stop Listening' : 'Speak'}
                            </button>
                            <button
                                onClick={handleStop}
                                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-all"
                            >
                                <VideoOff className="w-5 h-5" />
                                End
                            </button>
                        </div>

                        {/* Text input */}
                        <form onSubmit={handleTextSubmit} className="flex gap-2">
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder="Or type a message..."
                                className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                                disabled={isProcessing}
                            />
                            <button
                                type="submit"
                                disabled={!textInput.trim() || isProcessing}
                                className="px-4 py-2.5 rounded-xl bg-white text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AvatarInteraction;
