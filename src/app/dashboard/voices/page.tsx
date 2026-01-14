'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Mic2, Play, Volume2 } from 'lucide-react';

const voices = [
    { id: '1', name: 'Sarah', gender: 'Female', accent: 'American', preview: true },
    { id: '2', name: 'James', gender: 'Male', accent: 'British', preview: true },
    { id: '3', name: 'Emma', gender: 'Female', accent: 'Australian', preview: true },
    { id: '4', name: 'Michael', gender: 'Male', accent: 'American', preview: true },
];

export default function VoicesPage() {
    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Voices</h1>
                            <p className="text-gray-400 mt-1">Browse available voice options for your agents</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {voices.map((voice) => (
                            <div
                                key={voice.id}
                                className="bg-[#111111] rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        <Mic2 className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                        <Play className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                                <h3 className="text-white font-medium mb-1">{voice.name}</h3>
                                <p className="text-sm text-gray-400">{voice.gender} • {voice.accent}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
