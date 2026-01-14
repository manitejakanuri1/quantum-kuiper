'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { FileText, ExternalLink, Book, Code, Zap } from 'lucide-react';

const docs = [
    { title: 'Getting Started', description: 'Quick start guide to create your first agent', icon: Zap },
    { title: 'API Reference', description: 'Complete API documentation', icon: Code },
    { title: 'Guides', description: 'In-depth tutorials and best practices', icon: Book },
];

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Documentation</h1>
                            <p className="text-gray-400 mt-1">Learn how to integrate and use the API</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {docs.map((doc) => {
                            const Icon = doc.icon;
                            return (
                                <div
                                    key={doc.title}
                                    className="bg-[#111111] rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-white font-medium">{doc.title}</h3>
                                        <ExternalLink className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-sm text-gray-400">{doc.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
