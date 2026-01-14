'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { UserCircle, Plus } from 'lucide-react';
import Image from 'next/image';
import { AVAILABLE_FACES } from '@/lib/simile';

export default function AvatarsPage() {
    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Avatars</h1>
                            <p className="text-gray-400 mt-1">Browse and manage available avatars</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {AVAILABLE_FACES.map((face) => (
                            <div
                                key={face.id}
                                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#111111] border border-white/5 group cursor-pointer hover:border-white/20 transition-all"
                            >
                                <Image
                                    src={face.thumbnail}
                                    alt={face.name}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                />
                                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                    <h3 className="text-white font-medium">{face.name}</h3>
                                    <p className="text-xs text-gray-400 capitalize">{face.gender}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
