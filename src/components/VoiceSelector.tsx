'use client';

import { AVAILABLE_VOICES } from '@/lib/fishaudio';
import { Check, Volume2, Play, Mic, Globe, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { VoiceCloneUpload } from './VoiceCloneUpload';
import { VoiceGallery } from './VoiceGallery';
import type { CustomAssetStatus, VoiceType } from '@/lib/types';

type VoiceTab = 'default' | 'clone' | 'gallery';

interface VoiceSelectorProps {
    selectedVoice: string | null;
    onSelect: (voiceId: string) => void;
    // Custom voice props
    agentId?: string;
    voiceType?: VoiceType;
    customVoiceId?: string | null;
    customVoiceStatus?: CustomAssetStatus;
    customVoiceName?: string | null;
    onVoiceTypeChange?: (type: VoiceType) => void;
    onRemoveCustomVoice?: () => void;
}

export function VoiceSelector({
    selectedVoice,
    onSelect,
    agentId,
    voiceType = 'default',
    customVoiceId,
    customVoiceStatus = 'none',
    customVoiceName,
    onVoiceTypeChange,
    onRemoveCustomVoice,
}: VoiceSelectorProps) {
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
    const [activeTab, setActiveTab] = useState<VoiceTab>(
        voiceType === 'cloned' ? 'clone' :
        voiceType === 'gallery' ? 'gallery' : 'default'
    );

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            currentAudio?.pause();
        };
    }, [currentAudio]);

    const playVoicePreview = (voiceId: string, event: React.MouseEvent) => {
        event.stopPropagation();

        if (playingVoice === voiceId) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            setPlayingVoice(null);
            return;
        }

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
        if (!voice || !voice.preview) return;

        const audio = new Audio(voice.preview);
        setCurrentAudio(audio);
        setPlayingVoice(voiceId);

        audio.onended = () => {
            setPlayingVoice(null);
            setCurrentAudio(null);
        };

        audio.onerror = () => {
            setPlayingVoice(null);
            setCurrentAudio(null);
        };

        audio.play().catch(() => {
            setPlayingVoice(null);
            setCurrentAudio(null);
        });
    };

    // If no agentId, show simple mode (just preset voices)
    if (!agentId) {
        return <PresetVoiceList selectedVoice={selectedVoice} onSelect={onSelect} playingVoice={playingVoice} playVoicePreview={playVoicePreview} />;
    }

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-[#1A1A1A] rounded-lg p-1">
                <button
                    onClick={() => setActiveTab('default')}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                        activeTab === 'default' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Volume2 className="w-3.5 h-3.5" />
                    Default
                </button>
                <button
                    onClick={() => setActiveTab('clone')}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                        activeTab === 'clone' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Mic className="w-3.5 h-3.5" />
                    Clone Voice
                </button>
                <button
                    onClick={() => setActiveTab('gallery')}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                        activeTab === 'gallery' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Globe className="w-3.5 h-3.5" />
                    Gallery
                </button>
            </div>

            {/* Custom voice badge (if exists, shown on all tabs) */}
            {customVoiceId && customVoiceStatus === 'ready' && voiceType === 'cloned' && activeTab === 'default' && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Mic className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-text-primary font-medium">{customVoiceName || 'Cloned Voice'}</p>
                        <p className="text-xs text-green-400">Active — cloned voice</p>
                    </div>
                    {onRemoveCustomVoice && (
                        <button
                            onClick={onRemoveCustomVoice}
                            className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                            title="Remove custom voice"
                        >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                    )}
                </div>
            )}

            {/* Default voices tab */}
            {activeTab === 'default' && (
                <PresetVoiceList
                    selectedVoice={voiceType === 'default' ? selectedVoice : null}
                    onSelect={(id) => {
                        onSelect(id);
                        onVoiceTypeChange?.('default');
                    }}
                    playingVoice={playingVoice}
                    playVoicePreview={playVoicePreview}
                />
            )}

            {/* Clone voice tab */}
            {activeTab === 'clone' && (
                <VoiceCloneUpload
                    agentId={agentId}
                    currentStatus={customVoiceStatus}
                    currentVoiceName={customVoiceName}
                    onCloneComplete={(voiceId, voiceName) => {
                        onSelect(voiceId);
                        onVoiceTypeChange?.('cloned');
                    }}
                    onCancel={() => setActiveTab('default')}
                />
            )}

            {/* Gallery tab */}
            {activeTab === 'gallery' && (
                <VoiceGallery
                    selectedVoiceId={voiceType === 'gallery' ? selectedVoice : null}
                    onSelect={(voiceId, voiceName) => {
                        onSelect(voiceId);
                        onVoiceTypeChange?.('gallery');
                    }}
                />
            )}
        </div>
    );
}

// Extracted preset voice list (reused in simple + tabbed modes)
function PresetVoiceList({
    selectedVoice,
    onSelect,
    playingVoice,
    playVoicePreview,
}: {
    selectedVoice: string | null;
    onSelect: (voiceId: string) => void;
    playingVoice: string | null;
    playVoicePreview: (voiceId: string, event: React.MouseEvent) => void;
}) {
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
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected
                            ? 'bg-white/20'
                            : 'bg-white/10'
                            }`}>
                            <Volume2 className={`w-5 h-5 ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`} />
                        </div>

                        <div className="flex-1 text-left">
                            <h3 className="text-text-primary font-medium">{voice.name}</h3>
                            <p className="text-sm text-text-secondary capitalize">{voice.style} &bull; {voice.gender}</p>
                        </div>

                        <button
                            onClick={(e) => playVoicePreview(voice.id, e)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying
                                ? 'bg-green-500/20 text-green-400 animate-pulse'
                                : 'bg-white/10 text-text-secondary hover:bg-white/20 hover:text-text-primary'
                                }`}
                            title={isPlaying ? 'Playing...' : 'Play preview'}
                        >
                            <Play className={`w-4 h-4 ${isPlaying ? '' : 'ml-0.5'}`} />
                        </button>

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
