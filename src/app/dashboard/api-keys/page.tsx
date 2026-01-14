'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Key, Plus, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function APIKeysPage() {
    const [showKey, setShowKey] = useState(false);

    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">API Keys</h1>
                            <p className="text-gray-400 mt-1">Manage your API keys for programmatic access</p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors">
                            <Plus className="w-4 h-4" />
                            Create Key
                        </button>
                    </div>

                    <div className="bg-[#111111] rounded-2xl border border-white/5 p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                            <Key className="w-8 h-8 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">No API keys</h3>
                        <p className="text-gray-400 text-sm mb-6">Create an API key to integrate with your applications</p>
                        <button className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors">
                            Create API Key
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
