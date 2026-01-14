'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { SimliClient } from 'simli-client';

interface SimliAvatarProps {
    faceId: string;
    apiKey: string;
    isActive?: boolean;
    onReady?: () => void;
    onError?: (error: Error) => void;
}

export function SimliAvatar({
    faceId,
    apiKey,
    isActive = false,
    onReady,
    onError
}: SimliAvatarProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const simliClientRef = useRef<SimliClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize Simli client
    const initializeSimli = useCallback(async () => {
        if (!videoRef.current || !audioRef.current || simliClientRef.current) return;

        setIsLoading(true);

        try {
            const simliClient = new SimliClient();

            // Pass configuration to Simli
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            simliClient.Initialize({
                apiKey: apiKey,
                faceID: faceId,
                handleSilence: true,
                videoRef: videoRef as unknown as React.RefObject<HTMLVideoElement>,
                audioRef: audioRef as unknown as React.RefObject<HTMLAudioElement>,
                maxSessionLength: 60000,
                maxIdleTime: 30000,
                session_token: '',
                SimliURL: 'wss://api.simli.ai/StartWebRTCSession',
                showDebugInfo: false,
                syncAudio: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            await simliClient.start();

            simliClientRef.current = simliClient;
            setIsConnected(true);
            onReady?.();
        } catch (error) {
            console.error('Simli initialization error:', error);
            onError?.(error as Error);
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, faceId, onReady, onError]);

    // Send audio data to Simli
    const _sendAudio = useCallback(async (audioData: Uint8Array) => {
        if (!simliClientRef.current) return;

        try {
            simliClientRef.current.sendAudioData(audioData);
        } catch (error) {
            console.error('Error sending audio:', error);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (simliClientRef.current) {
                simliClientRef.current.close();
                simliClientRef.current = null;
            }
        };
    }, []);

    // Initialize when active
    useEffect(() => {
        if (isActive && !isConnected && !isLoading) {
            initializeSimli();
        }
    }, [isActive, isConnected, isLoading, initializeSimli]);

    return (
        <div className="relative w-full h-full">
            {/* Video output */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={false}
                className={`w-full h-full object-cover rounded-full ${isConnected ? 'opacity-100' : 'opacity-0'
                    } transition-opacity duration-500`}
            />

            {/* Audio output */}
            <audio ref={audioRef} autoPlay />

            {/* Loading state */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Fallback placeholder when not connected */}
            {!isConnected && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                            <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#a78bfa' }} />
                                <stop offset="100%" style={{ stopColor: '#67e8f9' }} />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" fill="url(#avatarGrad)" opacity="0.2" />
                        <ellipse cx="50" cy="45" rx="30" ry="35" fill="#fcd5b8" />
                        <path d="M 20 35 Q 20 10, 50 10 Q 80 10, 80 35 Q 75 25, 50 25 Q 25 25, 20 35" fill="#3d2314" />
                        <ellipse cx="38" cy="40" rx="5" ry="4" fill="white" />
                        <ellipse cx="62" cy="40" rx="5" ry="4" fill="white" />
                        <circle cx="38" cy="40" r="2.5" fill="#1a1a1a" />
                        <circle cx="62" cy="40" r="2.5" fill="#1a1a1a" />
                        <path d="M 43 58 Q 50 62, 57 58" stroke="#c47c7c" strokeWidth="2.5" fill="none" />
                    </svg>
                </div>
            )}
        </div>
    );
}

// Hook to use Simli audio streaming
export function useSimliAudio(simliClient: SimliClient | null) {
    const sendAudio = useCallback((audioData: Uint8Array) => {
        if (simliClient) {
            simliClient.sendAudioData(audioData);
        }
    }, [simliClient]);

    return { sendAudio };
}

export default SimliAvatar;
