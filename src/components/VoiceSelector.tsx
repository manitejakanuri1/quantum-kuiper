'use client';

import { AVAILABLE_VOICES } from '@/lib/fishaudio';
import { Check, Volume2 } from 'lucide-react';

interface VoiceSelectorProps {
    selectedVoice: string | null;
    onSelect: (voiceId: string) => void;
}

export function VoiceSelector({ selectedVoice, onSelect }: VoiceSelectorProps) {
    return (
        <div className="space-y-3">
            {AVAILABLE_VOICES.map((voice) => {
                const isSelected = selectedVoice === voice.id;

                return (
                    <div
                        key={voice.id}
                        onClick={() => onSelect(voice.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 cursor-pointer ${isSelected
                            ? 'bg-purple-500/20 border-2 border-purple-500 shadow-lg shadow-purple-500/10'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                    >
                        {/* Voice icon */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected
                            ? 'bg-gradient-to-br from-purple-500 to-cyan-500'
                            : 'bg-white/10'
                            }`}>
                            <Volume2 className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                        </div>

                        {/* Voice info */}
                        <div className="flex-1 text-left">
                            <h3 className="text-white font-medium">{voice.name}</h3>
                            <p className="text-sm text-gray-400 capitalize">{voice.style} • {voice.gender}</p>
                        </div>

                        {/* Selected indicator */}
                        {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Status info */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                    <Volume2 className="w-5 h-5 text-green-400" />
                    <h3 className="text-white font-medium">AI Voice Synthesis</h3>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">Active</span>
                </div>
                <p className="text-sm text-gray-400">
                    Select a voice for your AI agent. Powered by FishAudio.
                </p>
            </div>
        </div>
    );
}
