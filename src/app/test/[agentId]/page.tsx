import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAgentById } from '@/lib/db';
import { AVAILABLE_FACES } from '@/lib/simile';
import AvatarInteraction from '@/components/AvatarInteraction';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Helper to get face thumbnail URL
function getFacePreviewUrl(faceId?: string): string | undefined {
    if (!faceId) return undefined;
    const face = AVAILABLE_FACES.find(f => f.id === faceId);
    return face?.thumbnail;
}

export default async function TestAgentPage({ params }: { params: Promise<{ agentId: string }> }) {
    const session = await auth();
    if (!session?.user) {
        redirect('/auth/login');
    }

    const { agentId } = await params;
    const agent = await getAgentById(agentId);

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

    const facePreviewUrl = getFacePreviewUrl(agent.faceId);

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Dashboard</span>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-white font-medium">Test Mode</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    {/* Agent Visual */}
                    <div>
                        <AvatarInteraction
                            simli_faceid={agent.faceId || 'tmp9i8bbq7c'}
                            voiceId={agent.voiceId || '8ef4a238714b45718ce04243307c57a7'}
                            apiKey={process.env.NEXT_PUBLIC_SIMLI_API_KEY || ''}
                            facePreviewUrl={facePreviewUrl}
                            agentName={agent.name}
                            initialPrompt={`You are ${agent.name}, a helpful assistant. Keep responses brief and conversational.`}
                            className="w-full max-w-lg mx-auto"
                        />
                    </div>

                    {/* Agent Info & Instructions */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{agent.name}</h1>
                            <p className="text-gray-400 text-lg">
                                Ready to test. Click "Start Interaction" to begin chatting.
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h3 className="text-white font-semibold mb-4">Instructions</h3>
                            <ul className="space-y-3 text-gray-400">
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                                    Click "Start Interaction" to initialize the avatar depending on connection speed.
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                                    Speak clearly into your microphone when the avatar is listening.
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                                    The agent will respond based on the knowledge base from: <br />
                                    <span className="text-purple-400">{agent.websiteUrl}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
