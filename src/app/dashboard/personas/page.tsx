'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Users, Plus, Search, Copy, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Agent } from '@/lib/types';

// Face ID to image mapping
const faceImages: Record<string, string> = {
    'tmp9i8bbq7c': '/faces/mia.png',
    'tmptina': '/faces/tina.png',
    'tmpjosh': '/faces/josh.png',
    'tmpmarcus': '/faces/marcus.png',
    'tmpsara': '/faces/sara.png',
    'tmpalex': '/faces/alex.png',
};

export default function PersonasPage() {
    const { status } = useSession();
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'personas' | 'published'>('personas');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/login');
        } else if (status === 'authenticated') {
            loadAgents();
        }
    }, [status, router]);

    const loadAgents = async () => {
        try {
            const res = await fetch('/api/agents');
            if (res.ok) {
                const data = await res.json();
                setAgents(data.agents || []);
            }
        } catch (error) {
            console.error('Failed to load agents:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAgents = agents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getFaceImage = (faceId: string | undefined) => {
        if (!faceId) return '/faces/mia.png';
        return faceImages[faceId] || '/faces/mia.png';
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf9f7] flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Users className="w-6 h-6 text-gray-600" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
                                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
                                        {agents.length} persona{agents.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-sm mt-1">
                                    Create and manage AI personas for your conversations
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/create"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                            Create New Persona
                        </Link>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mb-6 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('personas')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'personas'
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Personas
                        </button>
                        <button
                            onClick={() => setActiveTab('published')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'published'
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Published
                        </button>
                    </div>

                    {/* Content */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        {/* Search Bar */}
                        <div className="p-4 border-b border-gray-100 flex justify-end">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search personas..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white w-64"
                                    />
                                </div>
                                <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        {filteredAgents.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No personas yet</h3>
                                <p className="text-gray-500 text-sm mb-6">Create your first persona to get started</p>
                                <Link
                                    href="/create"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Persona
                                </Link>
                            </div>
                        ) : (
                            <>
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Persona Name</th>
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Persona Type</th>
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAgents.map((agent) => (
                                            <tr key={agent.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                <td className="py-4 px-4">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 relative">
                                                        <Image
                                                            src={getFaceImage(agent.faceId)}
                                                            alt={agent.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <Link href={`/test/${agent.id}`} className="font-medium text-gray-900 hover:underline">
                                                        {agent.name}
                                                    </Link>
                                                </td>
                                                <td className="py-4 px-4 text-gray-500 text-sm">
                                                    {agent.websiteUrl ? `Knowledge from ${new URL(agent.websiteUrl).hostname}` : '-'}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="px-2.5 py-1 text-xs font-medium bg-gray-900 text-white rounded-md">
                                                        Custom
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-gray-500 text-sm">
                                                    {formatDate(agent.createdAt)}
                                                </td>
                                                <td className="py-4 px-4 text-gray-500 text-sm">
                                                    {formatDate(agent.createdAt)}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title="Copy embed code"
                                                        >
                                                            <Copy className="w-4 h-4 text-gray-400" />
                                                        </button>
                                                        <button
                                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title="More options"
                                                        >
                                                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                                    <p className="text-sm text-gray-500">
                                        1 - {filteredAgents.length} of {filteredAgents.length}.
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">Rows per page</span>
                                            <select className="border border-gray-200 rounded px-2 py-1 text-sm">
                                                <option>10</option>
                                                <option>25</option>
                                                <option>50</option>
                                            </select>
                                        </div>
                                        <span className="text-sm text-gray-500">Page 1 of 1</span>
                                        <div className="flex items-center gap-1">
                                            <button className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" disabled>
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" disabled>
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" disabled>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                            <button className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" disabled>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
