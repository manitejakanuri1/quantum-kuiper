'use client';

import Link from 'next/link';
import { Box, ArrowRightLeft, Sparkles } from 'lucide-react';

export function DeveloperQuickstart() {
    return (
        <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Developer quickstart</h3>
            <p className="text-sm text-gray-400 mb-6">
                Learn the basics and make your first request with the Anam API.
            </p>

            {/* Integration Flow Visual */}
            <div className="flex items-center justify-center gap-4 mb-6 py-4">
                <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <Box className="w-6 h-6 text-gray-400" />
                </div>
                <ArrowRightLeft className="w-5 h-5 text-gray-500" />
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20">
                    <Sparkles className="w-5 h-5 text-white" />
                    <span className="text-white font-medium">Talk to Site</span>
                </div>
            </div>

            {/* Get Started Button */}
            <Link
                href="/dashboard/docs"
                className="inline-flex items-center px-4 py-2 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
                Get Started
            </Link>
        </div>
    );
}
