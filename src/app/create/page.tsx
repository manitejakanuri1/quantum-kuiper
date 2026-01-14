'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Save, Play, Loader2, Sparkles } from 'lucide-react';
import { FaceGallery } from '@/components/FaceGallery';
import { VoiceSelector } from '@/components/VoiceSelector';
import { AVAILABLE_FACES } from '@/lib/simile';

type Tab = 'prompt' | 'avatar' | 'voice' | 'llm' | 'tools';

// Default System Prompt Template
const DEFAULT_SYSTEM_PROMPT = `[Identity]
You are a friendly and helpful AI voice assistant for this website. You provide accurate information about the company's products, services, and help answer customer questions in a conversational manner.

[Style]
Sound friendly, professional, and knowledgeable
Use a conversational tone with natural speech patterns
Be approachable and helpful when explaining information
Adapt your communication style to match the customer's needs

[Response Guidelines]
Keep responses clear, concise, and informative
Ask clarifying questions when needed
Confirm important details before proceeding
Use simple, accessible language
Express understanding and empathy for customer concerns

[Task & Goals]
Provide information about products and services
Answer frequently asked questions
Guide customers through processes
Connect customers with the right resources

[Error Handling / Fallback]
If the request is unclear, ask for clarification
If you don't have specific information, offer alternative help
For complex queries, suggest contacting support directly`;

export default function CreateAgentPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Tab state
    const [activeTab, setActiveTab] = useState<Tab>('prompt');

    // Form state
    const [agentName, setAgentName] = useState('New Agent');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [promptDescription, setPromptDescription] = useState('A knowledgeable customer service agent helping with inquiries');
    const [selectedFace, setSelectedFace] = useState<string | null>(AVAILABLE_FACES[0]?.id || null);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [skipGreeting, setSkipGreeting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Override face from URL params if provided
    useEffect(() => {
        const faceParam = searchParams.get('face');
        if (faceParam) {
            setSelectedFace(faceParam);
        }
    }, [searchParams]);

    // Redirect if not authenticated
    if (status === 'unauthenticated') {
        router.push('/auth/login');
        return null;
    }

    // Get selected face thumbnail
    const selectedFaceData = AVAILABLE_FACES.find(f => f.id === selectedFace);

    // Calculate token count (rough estimate)
    const tokenCount = Math.ceil(systemPrompt.length / 4);
    const maxTokens = 120000;

    const handleSave = async () => {
        if (!agentName.trim()) {
            setError('Please enter a name for your agent');
            return;
        }
        if (!selectedFace) {
            setError('Please select an avatar');
            setActiveTab('avatar');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const response = await fetch('/api/agents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: agentName,
                    websiteUrl,
                    faceId: selectedFace,
                    voiceId: selectedVoice,
                    systemPrompt,
                    promptDescription
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create agent');
            }

            router.push('/dashboard');
        } catch (err) {
            setError('Failed to create agent. Please try again.');
            setSaving(false);
        }
    };

    const tabs: { id: Tab; label: string; badge?: string }[] = [
        { id: 'prompt', label: 'Prompt' },
        { id: 'avatar', label: 'Avatar' },
        { id: 'voice', label: 'Voice' },
        { id: 'llm', label: 'LLM' },
        { id: 'tools', label: 'Tools' },
    ];

    return (
        <div className="min-h-screen bg-black flex">
            {/* Left Panel - Avatar Preview */}
            <div className="w-[45%] border-r border-white/5 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
                    <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <input
                        type="text"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="bg-transparent text-white text-lg font-medium focus:outline-none border-b border-transparent focus:border-white/30 transition-colors"
                        placeholder="Agent Name"
                    />
                </div>

                {/* Avatar Preview Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden bg-[#111111] border border-white/5">
                        {selectedFaceData ? (
                            <Image
                                src={selectedFaceData.thumbnail}
                                alt={selectedFaceData.name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                                        <Sparkles className="w-8 h-8 text-gray-500" />
                                    </div>
                                    <p className="text-gray-500">Select an avatar to preview</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Start Button */}
                    <button className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#111111] border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors">
                        <Play className="w-4 h-4" />
                        Start
                    </button>
                </div>
            </div>

            {/* Right Panel - Configuration */}
            <div className="flex-1 flex flex-col">
                {/* Header with Save button */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    {/* Tabs */}
                    <div className="flex gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-[#1a1a1a] text-white'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Prompt Tab */}
                    {activeTab === 'prompt' && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-white flex items-center gap-2">
                                        System Prompt
                                        <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-400">?</span>
                                    </label>
                                </div>

                                {/* Description Input with Generate */}
                                <div className="flex gap-3 mb-4">
                                    <input
                                        type="text"
                                        value={promptDescription}
                                        onChange={(e) => setPromptDescription(e.target.value)}
                                        placeholder="A knowledgeable customer service agent..."
                                        className="flex-1 bg-[#111111] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/20"
                                    />
                                    <button className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors">
                                        Generate
                                    </button>
                                </div>

                                {/* Website URL Input */}
                                <div className="mb-4">
                                    <label className="block text-sm text-gray-400 mb-2">Website URL (optional)</label>
                                    <input
                                        type="url"
                                        value={websiteUrl}
                                        onChange={(e) => setWebsiteUrl(e.target.value)}
                                        placeholder="https://yourwebsite.com"
                                        className="w-full bg-[#111111] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/20"
                                    />
                                </div>

                                {/* System Prompt Textarea */}
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    className="w-full h-[400px] bg-[#111111] border border-white/10 rounded-lg px-4 py-3 text-white text-sm font-mono leading-relaxed placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                                    placeholder="Enter your system prompt..."
                                />

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={skipGreeting}
                                            onChange={(e) => setSkipGreeting(e.target.checked)}
                                            className="w-4 h-4 rounded bg-[#111111] border border-white/20 text-white focus:ring-0 focus:ring-offset-0"
                                        />
                                        Skip greeting
                                    </label>
                                    <div className="text-sm text-gray-500">
                                        <span className="text-white">{tokenCount}</span> / 120,000 tokens
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Avatar Tab */}
                    {activeTab === 'avatar' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-white mb-4">Select Avatar</h3>
                            <FaceGallery
                                selectedFace={selectedFace}
                                onSelect={setSelectedFace}
                            />
                        </div>
                    )}

                    {/* Voice Tab */}
                    {activeTab === 'voice' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-white mb-4">Select Voice</h3>
                            <VoiceSelector
                                selectedVoice={selectedVoice}
                                onSelect={setSelectedVoice}
                            />
                        </div>
                    )}

                    {/* LLM Tab */}
                    {activeTab === 'llm' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-white mb-4">LLM Configuration</h3>
                            <div className="bg-[#111111] rounded-xl border border-white/5 p-6">
                                <p className="text-gray-400 text-sm">LLM configuration coming soon. Default model will be used.</p>
                            </div>
                        </div>
                    )}

                    {/* Tools Tab */}
                    {activeTab === 'tools' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium text-white">Tools</h3>
                                <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-gray-400 rounded">Beta</span>
                            </div>
                            <div className="bg-[#111111] rounded-xl border border-white/5 p-6">
                                <p className="text-gray-400 text-sm">Tools configuration coming soon. Connect external APIs and functions to your agent.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
