'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { FaceGallery } from '@/components/FaceGallery';
import { VoiceSelector } from '@/components/VoiceSelector';
import { Agent } from '@/lib/types';

interface EditAgentPageProps {
    params: Promise<{ id: string }>;
}

export default function EditAgentPage({ params }: EditAgentPageProps) {
    const router = useRouter();
    const [agent, setAgent] = useState<Agent | null>(null);
    const [name, setName] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [selectedFace, setSelectedFace] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        async function loadAgent() {
            try {
                const { id } = await params;
                const response = await fetch(`/api/agents/${id}`);
                if (!response.ok) {
                    throw new Error('Agent not found');
                }
                const data = await response.json();
                setAgent(data);
                setName(data.name || '');
                setWebsiteUrl(data.websiteUrl || '');
                setSelectedFace(data.faceId || '');
                setSelectedVoice(data.voiceId || '');
            } catch (err) {
                setError('Failed to load agent');
            } finally {
                setIsLoading(false);
            }
        }
        loadAgent();
    }, [params]);

    const handleSave = async () => {
        if (!agent) return;

        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`/api/agents/${agent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    websiteUrl,
                    faceId: selectedFace,
                    voiceId: selectedVoice,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update agent');
            }

            setSuccess('Agent updated successfully!');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err) {
            setError('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
                    <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Dashboard</span>
                </Link>
                <h1 className="text-xl font-semibold text-white">Edit Agent</h1>
                <div className="w-32" />
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Status Messages */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300">
                        {success}
                    </div>
                )}

                {/* Basic Info */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white">Basic Information</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Agent Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="My Agent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Website URL
                            </label>
                            <input
                                type="url"
                                value={websiteUrl}
                                onChange={(e) => setWebsiteUrl(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="https://example.com"
                            />
                        </div>
                    </div>
                </section>

                {/* Face Selection */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white">Avatar Face</h2>
                    <FaceGallery
                        selectedFace={selectedFace}
                        onSelect={setSelectedFace}
                    />
                </section>

                {/* Voice Selection */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white">Voice</h2>
                    <VoiceSelector
                        selectedVoice={selectedVoice}
                        onSelect={setSelectedVoice}
                    />
                </section>

                {/* Save Button */}
                <div className="flex justify-end gap-4">
                    <Link
                        href="/dashboard"
                        className="px-6 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold hover:from-purple-700 hover:to-cyan-700 transition-all disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
