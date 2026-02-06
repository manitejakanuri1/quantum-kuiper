'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Brain } from 'lucide-react';

export default function LLMsPage() {
    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">LLMs</h1>
                            <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-gray-400 rounded">Coming Soon</span>
                        </div>
                    </div>

                    <div className="bg-[#111111] rounded-2xl border border-white/5 p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                            <Brain className="w-8 h-8 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">Coming Soon</h3>
                        <p className="text-gray-400 text-sm">LLM configuration will be available soon</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
