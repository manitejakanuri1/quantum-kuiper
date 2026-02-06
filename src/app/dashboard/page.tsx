'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { AgentTemplates } from '@/components/AgentTemplates';
import { DeveloperQuickstart } from '@/components/DeveloperQuickstart';
import { UsageChart } from '@/components/UsageChart';
import { EmbedModal } from '@/components/EmbedModal';
import { Agent } from '@/lib/types';

// Get greeting based on time of day
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [embedAgent, setEmbedAgent] = useState<Agent | null>(null);

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

    // Get user display name
    const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';
    const orgName = `${userName.toUpperCase()}'s Organization`;

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex">
            {/* Sidebar */}
            <DashboardSidebar />

            {/* Main Content */}
            <main className="flex-1 ml-56 min-h-screen">
                <div className="max-w-5xl mx-auto px-8 py-10">
                    {/* Header with Greeting */}
                    <div className="mb-10">
                        <p className="text-sm text-gray-500 mb-1">{orgName}</p>
                        <h1 className="text-3xl font-bold text-white">
                            {getGreeting()}, <span className="text-white">{userName.toUpperCase()}</span>
                        </h1>
                    </div>

                    {/* Agent Templates */}
                    <AgentTemplates />

                    {/* Two Column Grid: Developer Quickstart + Minutes Used */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DeveloperQuickstart />
                        <UsageChart />
                    </div>
                </div>
            </main>

            {/* Embed Modal */}
            {embedAgent && (
                <EmbedModal
                    agentId={embedAgent.id}
                    agentName={embedAgent.name}
                    onClose={() => setEmbedAgent(null)}
                />
            )}
        </div>
    );
}
