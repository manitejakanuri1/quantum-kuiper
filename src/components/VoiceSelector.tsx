'use client';

import { AVAILABLE_VOICES } from '@/lib/fishaudio';
import { Check, Volume2, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

interface VoiceSelectorProps {
    selectedVoice: string | null;
    onSelect: (voiceId: string) => void;
}

export function VoiceSelector({ selectedVoice, onSelect }: VoiceSelectorProps) {
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            currentAudio?.pause();
        };
    }, [currentAudio]);

    const playVoicePreview = (voiceId: string, event: React.MouseEvent) => {
        // Prevent triggering the select action
        event.stopPropagation();

        // If already playing this voice, stop it
        if (playingVoice === voiceId) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            setPlayingVoice(null);
            return;
        }

        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        // Find voice and get preview path
        const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
        if (!voice || !voice.preview) {
            console.error('No preview available for voice:', voiceId);
            return;
        }

        // Use static audio file - instant playback, no API call!
        const audio = new Audio(voice.preview);
        setCurrentAudio(audio);
        setPlayingVoice(voiceId);

        audio.onended = () => {
            setPlayingVoice(null);
            setCurrentAudio(null);
        };

        audio.onerror = () => {
            console.error('Failed to load audio preview:', voice.preview);
            setPlayingVoice(null);
            setCurrentAudio(null);
        };

        audio.play().catch(error => {
            console.error('Audio playback error:', error);
            setPlayingVoice(null);
            setCurrentAudio(null);
        });
    };

    return (
        <div className="space-y-3">
            {AVAILABLE_VOICES.map((voice) => {
                const isSelected = selectedVoice === voice.id;
                const isPlaying = playingVoice === voice.id;

                return (
                    <div
                        key={voice.id}
                        onClick={() => onSelect(voice.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 cursor-pointer ${isSelected
                            ? 'bg-white/10 border-2 border-white/40 shadow-lg shadow-white/5'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                    >
                        {/* Voice icon */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected
                            ? 'bg-white/20'
                            : 'bg-white/10'
                            }`}>
                            <Volume2 className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                        </div>

                        {/* Voice info */}
                        <div className="flex-1 text-left">
                            <h3 className="text-white font-medium">{voice.name}</h3>
                            <p className="text-sm text-gray-400 capitalize">{voice.style} • {voice.gender}</p>
                        </div>

                        {/* Play preview button */}
                        <button
                            onClick={(e) => playVoicePreview(voice.id, e)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying
                                ? 'bg-green-500/20 text-green-400 animate-pulse'
                                : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                                }`}
                            title={isPlaying ? 'Playing...' : 'Play preview'}
                        >
                            <Play className={`w-4 h-4 ${isPlaying ? '' : 'ml-0.5'}`} />
                        </button>

                        {/* Selected indicator */}
                        {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                                <Check className="w-4 h-4 text-black" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
