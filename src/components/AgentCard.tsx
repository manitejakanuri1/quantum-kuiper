'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Agent } from '@/lib/types';
import { Power, Code2, RefreshCw, Trash2, MoreVertical, Volume2, MessageSquare, User, Pencil } from 'lucide-react';
import { AVAILABLE_FACES } from '@/lib/simile';

// Helper component to display face image based on faceId
function FaceImage({ faceId }: { faceId?: string }) {
    const face = AVAILABLE_FACES.find(f => f.id === faceId);
    const thumbnail = face?.thumbnail;
    const hasValidThumbnail = thumbnail && thumbnail.startsWith('/faces/') &&
        (thumbnail.endsWith('.png') || thumbnail.endsWith('.jpg') || thumbnail.endsWith('.jpeg'));

    if (hasValidThumbnail) {
        return (
            <Image
                src={thumbnail}
                alt={face?.name || 'Agent'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
            />
        );
    }

    // Fallback placeholder
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center">
                <User className="w-12 h-12 text-white/60" />
            </div>
        </div>
    );
}

interface AgentCardProps {
    agent: Agent;
    onToggleStatus: (id: string) => void;
    onGetEmbed: (id: string) => void;
    onRetrain: (id: string) => void;
    onDelete: (id: string) => void;
}

export function AgentCard({ agent, onToggleStatus, onGetEmbed, onRetrain, onDelete }: AgentCardProps) {
    const [showMenu, setShowMenu] = useState(false);
    const isActive = agent.status === 'active';

    return (
        <div className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
            {/* Face Preview */}
            <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
                {/* Real face image based on faceId */}
                <FaceImage faceId={agent.faceId} />

                {/* Status badge */}
                <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isActive
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                    {isActive ? 'Active' : 'Disabled'}
                </div>

                {/* Voice indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/70 text-xs">
                    <Volume2 className="w-3 h-3" />
                    Voice
                </div>

                {/* More menu */}
                <div className="absolute bottom-3 right-3">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    {showMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-white/20 rounded-xl shadow-xl py-2 min-w-[140px] z-10">
                            <Link
                                href={`/edit/${agent.id}`}
                                onClick={() => setShowMenu(false)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                                Edit
                            </Link>
                            <button
                                onClick={() => { onRetrain(agent.id); setShowMenu(false); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Retrain
                            </button>
                            <button
                                onClick={() => { onDelete(agent.id); setShowMenu(false); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Agent Info */}
            <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
                <p className="text-sm text-gray-400 truncate mb-4">{agent.websiteUrl}</p>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Link
                        href={`/test/${agent.id}`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white hover:from-purple-500/30 hover:to-cyan-500/30 border border-white/10 transition-all hover:shadow-lg hover:shadow-purple-500/10"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Test
                    </Link>

                    <button
                        onClick={() => onGetEmbed(agent.id)}
                        className="flex-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white border border-white/10 transition-all"
                        title="Get Embed Code"
                    >
                        <Code2 className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => onToggleStatus(agent.id)}
                        className={`flex-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 border border-gray-500/30'
                            }`}
                        title={isActive ? 'Disable' : 'Enable'}
                    >
                        <Power className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
