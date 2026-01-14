
'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';

export default function FeedbackPage() {
    const [feedback, setFeedback] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (feedback.trim()) {
            setSubmitted(true);
            setFeedback('');
        }
    };

    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white">Feedback</h1>
                        <p className="text-gray-400 mt-1">Help us improve by sharing your thoughts</p>
                    </div>

                    {submitted ? (
                        <div className="bg-[#111111] rounded-2xl border border-white/5 p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-green-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Thank you!</h3>
                            <p className="text-gray-400 text-sm mb-6">Your feedback has been submitted successfully</p>
                            <button
                                onClick={() => setSubmitted(false)}
                                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                            >
                                Send More Feedback
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="bg-[#111111] rounded-2xl border border-white/5 p-6">
                            <label className="block text-sm font-medium text-white mb-2">
                                Your Feedback
                            </label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Tell us what's on your mind..."
                                className="w-full h-40 bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none mb-4"
                            />
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                                Submit Feedback
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
