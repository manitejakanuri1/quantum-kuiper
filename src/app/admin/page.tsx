'use client';

import { useState, useEffect } from 'react';
import { Loader2, Globe, Save, Trash2, Play, Check, RefreshCw, Edit } from 'lucide-react';

interface QAPair {
    id?: string;
    question: string;
    spoken_response: string;
    keywords: string[];
    priority: number;
}

interface UserQuestion {
    id: string;
    agent_id: string;
    question: string;
    answer_given?: string;
    confidence?: number;
    was_successful: boolean;
    asked_at: string;
}

interface Agent {
    id: string;
    name: string;
    website_url?: string;
    status: string;
}

const RAG_API = 'http://localhost:8080';

export default function AdminPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [crawlResult, setCrawlResult] = useState<{
        success?: boolean;
        pages_crawled?: number;
        content_preview?: string;
        qa_suggestions?: Array<{ question: string; source_content?: string; keywords?: string[] }>;
    } | null>(null);
    const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
    const [existingQA, setExistingQA] = useState<QAPair[]>([]);
    const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
    const [editingQAId, setEditingQAId] = useState<string | null>(null);
    const [editingQA, setEditingQA] = useState<QAPair | null>(null);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'crawl' | 'manage' | 'questions'>('crawl');

    // Load agents on mount
    useEffect(() => {
        loadAgents();
    }, []);

    // Load existing Q&A when agent changes
    useEffect(() => {
        if (selectedAgent) {
            loadExistingQA();
            loadUserQuestions();
        }
    }, [selectedAgent]);

    const loadAgents = async () => {
        try {
            const res = await fetch(`${RAG_API}/api/agents`);
            const data = await res.json();
            setAgents(data.agents || []);
            if (data.agents?.length > 0) {
                setSelectedAgent(data.agents[0].id);
            }
        } catch (error) {
            console.error('Failed to load agents:', error);
        }
    };

    const loadExistingQA = async () => {
        try {
            const res = await fetch(`${RAG_API}/api/qa/${selectedAgent}`);
            const data = await res.json();
            setExistingQA(data.qa_pairs || []);
        } catch (error) {
            console.error('Failed to load Q&A:', error);
        }
    };

    const loadUserQuestions = async () => {
        try {
            const res = await fetch(`${RAG_API}/api/user-questions/${selectedAgent}`);
            const data = await res.json();
            setUserQuestions(data.questions || []);
        } catch (error) {
            console.error('Failed to load user questions:', error);
        }
    };

    const handleCrawl = async () => {
        if (!websiteUrl || !selectedAgent) return;

        setIsLoading(true);
        setMessage('Crawling website...');

        try {
            const res = await fetch(`${RAG_API}/api/crawl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: websiteUrl,
                    agent_id: selectedAgent,
                    max_pages: 5
                })
            });

            const data = await res.json();
            setCrawlResult(data);

            if (data.success) {
                setMessage(`✅ Crawled ${data.pages_crawled} pages!`);
                // Convert suggestions to Q&A pairs for editing
                const suggestions = data.qa_suggestions.map((s: { question: string; source_content?: string; keywords?: string[] }) => ({
                    question: s.question,
                    spoken_response: s.source_content || '',
                    keywords: s.keywords || [],
                    priority: 5
                }));
                setQaPairs(suggestions);
            } else {
                setMessage('❌ Crawl failed. Check the URL.');
            }
        } catch (error) {
            setMessage('❌ Error: ' + (error as Error).message);
        }

        setIsLoading(false);
    };

    const handleSaveQA = async () => {
        if (qaPairs.length === 0) return;

        setIsLoading(true);
        setMessage('Saving Q&A pairs...');

        try {
            const res = await fetch(`${RAG_API}/api/qa/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: selectedAgent,
                    qa_pairs: qaPairs
                })
            });

            const data = await res.json();

            if (data.success) {
                setMessage(`✅ Saved ${data.saved_count} Q&A pairs!`);
                setQaPairs([]);
                loadExistingQA();
            } else {
                setMessage('❌ Failed to save');
            }
        } catch (error) {
            setMessage('❌ Error: ' + (error as Error).message);
        }

        setIsLoading(false);
    };

    const handleDeleteQA = async (qaId: string) => {
        try {
            await fetch(`${RAG_API}/api/qa/${selectedAgent}/${qaId}`, {
                method: 'DELETE'
            });
            loadExistingQA();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const updateQAPair = (index: number, field: keyof QAPair, value: string | string[] | number) => {
        const updated = [...qaPairs];
        if (field === 'keywords') {
            updated[index][field] = value as string[];
        } else if (field === 'priority') {
            updated[index][field] = value as number;
        } else {
            updated[index][field] = value as string;
        }
        setQaPairs(updated);
    };

    const addNewQAPair = () => {
        setQaPairs([...qaPairs, {
            question: '',
            spoken_response: '',
            keywords: [],
            priority: 5
        }]);
    };

    const removeQAPair = (index: number) => {
        setQaPairs(qaPairs.filter((_, i) => i !== index));
    };

    const handleDeleteUserQuestion = async (questionId: string) => {
        try {
            await fetch(`${RAG_API}/api/user-questions/${questionId}`, {
                method: 'DELETE'
            });
            loadUserQuestions();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const handleConvertToQA = async (userQuestion: UserQuestion) => {
        setMessage('Converting to Q&A pair...');
        try {
            const res = await fetch(`${RAG_API}/api/user-questions/convert-to-qa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: userQuestion.id,
                    agent_id: selectedAgent,
                    question: userQuestion.question,
                    spoken_response: userQuestion.answer_given || 'Please provide an answer for this question.',
                    keywords: [],
                    priority: 5
                })
            });

            const data = await res.json();

            if (data.success) {
                setMessage('✅ Converted to Q&A pair!');
                loadUserQuestions();
                loadExistingQA();
            } else {
                setMessage('❌ Failed to convert');
            }
        } catch (error) {
            setMessage('❌ Error: ' + (error as Error).message);
        }
    };

    const handleEditQA = (qa: QAPair) => {
        setEditingQAId(qa.id || null);
        setEditingQA({ ...qa });
    };

    const handleCancelEdit = () => {
        setEditingQAId(null);
        setEditingQA(null);
    };

    const handleSaveEdit = async () => {
        if (!editingQA || !editingQAId) return;

        setIsLoading(true);
        setMessage('Updating Q&A pair...');

        try {
            const res = await fetch(`${RAG_API}/api/qa/${selectedAgent}/${editingQAId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: editingQA.question,
                    spoken_response: editingQA.spoken_response,
                    keywords: editingQA.keywords,
                    priority: editingQA.priority
                })
            });

            const data = await res.json();

            if (data.success) {
                setMessage('✅ Q&A pair updated!');
                setEditingQAId(null);
                setEditingQA(null);
                loadExistingQA();
            } else {
                setMessage('❌ Failed to update');
            }
        } catch (error) {
            setMessage('❌ Error: ' + (error as Error).message);
        }

        setIsLoading(false);
    };

    const updateEditingQA = (field: keyof QAPair, value: string | string[] | number) => {
        if (!editingQA) return;

        const updated = { ...editingQA };
        if (field === 'keywords') {
            updated[field] = value as string[];
        } else if (field === 'priority') {
            updated[field] = value as number;
        } else {
            updated[field] = value as string;
        }
        setEditingQA(updated);
    };

    return (
        <div className="min-h-screen bg-black p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        RAG Admin Panel
                    </h1>
                    <p className="text-gray-400">
                        Crawl websites and curate Q&A pairs for your voice agent
                    </p>
                </div>

                {/* Agent Selector */}
                <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
                    <label className="block text-white text-sm font-medium mb-2">
                        Select Agent
                    </label>
                    <select
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-white/20"
                    >
                        {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name} ({agent.id.slice(0, 8)}...)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('crawl')}
                        className={`px-6 py-3 rounded-lg font-medium transition ${activeTab === 'crawl'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        🌐 Crawl & Create
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`px-6 py-3 rounded-lg font-medium transition ${activeTab === 'manage'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        📚 Manage Q&A ({existingQA.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`px-6 py-3 rounded-lg font-medium transition ${activeTab === 'questions'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        ❓ User Questions ({userQuestions.length})
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.includes('✅') ? 'bg-green-500/20 text-green-400' :
                        message.includes('❌') ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Crawl Tab */}
                {activeTab === 'crawl' && (
                    <div className="space-y-6">
                        {/* Website URL Input */}
                        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Globe className="w-5 h-5" />
                                Step 1: Enter Website URL
                            </h2>
                            <div className="flex gap-4">
                                <input
                                    type="url"
                                    value={websiteUrl}
                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className="flex-1 bg-slate-800 text-white rounded-lg px-4 py-3 border border-white/20"
                                />
                                <button
                                    onClick={handleCrawl}
                                    disabled={isLoading || !websiteUrl}
                                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-5 h-5" />
                                    )}
                                    Crawl
                                </button>
                            </div>
                        </div>

                        {/* Crawl Result Preview */}
                        {crawlResult?.content_preview && (
                            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                                <h2 className="text-xl font-semibold text-white mb-4">
                                    📄 Content Preview
                                </h2>
                                <pre className="text-gray-300 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-800/50 p-4 rounded-lg">
                                    {crawlResult.content_preview}
                                </pre>
                            </div>
                        )}

                        {/* Q&A Pairs Editor */}
                        {qaPairs.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-white">
                                        Step 2: Curate Q&A Pairs ({qaPairs.length})
                                    </h2>
                                    <button
                                        onClick={addNewQAPair}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                                    >
                                        + Add Q&A
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {qaPairs.map((qa, index) => (
                                        <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-purple-400 text-sm font-medium">Q&A #{index + 1}</span>
                                                <button
                                                    onClick={() => removeQAPair(index)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <input
                                                type="text"
                                                value={qa.question}
                                                onChange={(e) => updateQAPair(index, 'question', e.target.value)}
                                                placeholder="Question"
                                                className="w-full bg-slate-700 text-white rounded px-3 py-2 mb-2 border border-white/10"
                                            />

                                            <textarea
                                                value={qa.spoken_response}
                                                onChange={(e) => updateQAPair(index, 'spoken_response', e.target.value)}
                                                placeholder="Spoken response (write exactly as it should be spoken)"
                                                rows={3}
                                                className="w-full bg-slate-700 text-white rounded px-3 py-2 mb-2 border border-white/10"
                                            />

                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={qa.keywords.join(', ')}
                                                    onChange={(e) => updateQAPair(index, 'keywords', e.target.value.split(',').map(k => k.trim()))}
                                                    placeholder="Keywords (comma-separated)"
                                                    className="flex-1 bg-slate-700 text-white rounded px-3 py-2 text-sm border border-white/10"
                                                />
                                                <input
                                                    type="number"
                                                    value={qa.priority}
                                                    onChange={(e) => updateQAPair(index, 'priority', parseInt(e.target.value))}
                                                    min={1}
                                                    max={10}
                                                    className="w-20 bg-slate-700 text-white rounded px-3 py-2 text-sm border border-white/10"
                                                    title="Priority (1-10)"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleSaveQA}
                                    disabled={isLoading || qaPairs.length === 0}
                                    className="mt-4 w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5" />
                                    )}
                                    Save to Supabase
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Manage Tab */}
                {activeTab === 'manage' && (
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">
                                Existing Q&A Pairs
                            </h2>
                            <button
                                onClick={loadExistingQA}
                                className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>

                        {existingQA.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">
                                No Q&A pairs found for this agent. Crawl a website to add some!
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {existingQA.map((qa) => (
                                    <div key={qa.id} className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                                        {editingQAId === qa.id ? (
                                            // Edit Mode
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Question</label>
                                                    <input
                                                        type="text"
                                                        value={editingQA?.question || ''}
                                                        onChange={(e) => updateEditingQA('question', e.target.value)}
                                                        className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-white/10"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Response</label>
                                                    <textarea
                                                        value={editingQA?.spoken_response || ''}
                                                        onChange={(e) => updateEditingQA('spoken_response', e.target.value)}
                                                        rows={4}
                                                        className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-white/10"
                                                    />
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-gray-400 block mb-1">Keywords (comma-separated)</label>
                                                        <input
                                                            type="text"
                                                            value={editingQA?.keywords.join(', ') || ''}
                                                            onChange={(e) => updateEditingQA('keywords', e.target.value.split(',').map(k => k.trim()))}
                                                            className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-white/10"
                                                        />
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="text-xs text-gray-400 block mb-1">Priority</label>
                                                        <input
                                                            type="number"
                                                            value={editingQA?.priority || 5}
                                                            onChange={(e) => updateEditingQA('priority', parseInt(e.target.value))}
                                                            min={1}
                                                            max={10}
                                                            className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-white/10"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        disabled={isLoading}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-2 disabled:opacity-50"
                                                    >
                                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // View Mode
                                            <div className="flex justify-between">
                                                <div className="flex-1">
                                                    <p className="text-purple-400 font-medium mb-1">
                                                        Q: {qa.question}
                                                    </p>
                                                    <p className="text-gray-300 text-sm mb-2">
                                                        A: {qa.spoken_response?.slice(0, 150)}{qa.spoken_response && qa.spoken_response.length > 150 ? '...' : ''}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        <span>Priority: {qa.priority}</span>
                                                        {qa.keywords && qa.keywords.length > 0 && (
                                                            <span>Keywords: {qa.keywords.slice(0, 3).join(', ')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleEditQA(qa)}
                                                        className="text-blue-400 hover:text-blue-300"
                                                        title="Edit Q&A pair"
                                                    >
                                                        <Edit className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => qa.id && handleDeleteQA(qa.id)}
                                                        className="text-red-400 hover:text-red-300"
                                                        title="Delete Q&A pair"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* User Questions Tab */}
                {activeTab === 'questions' && (
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">
                                User Questions ({userQuestions.length})
                            </h2>
                            <button
                                onClick={loadUserQuestions}
                                className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>

                        <p className="text-gray-400 text-sm mb-4">
                            Questions asked by users that you can convert to Q&A pairs
                        </p>

                        {userQuestions.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">
                                No user questions yet. Questions will appear here when users interact with the agent.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {userQuestions.map((uq) => (
                                    <div key={uq.id} className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <p className="text-cyan-400 font-medium">
                                                        Q: {uq.question}
                                                    </p>
                                                    {!uq.was_successful && (
                                                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                                                            Failed
                                                        </span>
                                                    )}
                                                </div>

                                                {uq.answer_given && (
                                                    <p className="text-gray-300 text-sm mb-2">
                                                        A: {uq.answer_given.slice(0, 150)}...
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    {uq.confidence && (
                                                        <span>Confidence: {uq.confidence.toFixed(1)}%</span>
                                                    )}
                                                    <span>{new Date(uq.asked_at).toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 ml-4">
                                                <button
                                                    onClick={() => handleConvertToQA(uq)}
                                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1"
                                                    title="Convert to Q&A pair"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Convert
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUserQuestion(uq.id)}
                                                    className="text-red-400 hover:text-red-300"
                                                    title="Delete question"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Test Section */}
                <div className="mt-8 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 rounded-xl p-6 border border-purple-500/30">
                    <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                        <Play className="w-5 h-5" />
                        Step 3: Test Your Voice Agent
                    </h2>
                    <p className="text-gray-400 mb-4">
                        After saving Q&A pairs, test your agent at the main page.
                    </p>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                    >
                        Go to Voice Agent →
                    </a>
                </div>
            </div>
        </div>
    );
}
