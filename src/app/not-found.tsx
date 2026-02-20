'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-9xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            404
          </h1>
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Search className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-white mb-4">
          Page Not Found
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-lg mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>

        {/* Popular Links */}
        <div className="mt-12 p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h3 className="text-white font-semibold mb-4">Popular Pages</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <Link href="/dashboard" className="text-gray-400 hover:text-purple-400 transition-colors">
              → Dashboard
            </Link>
            <Link href="/dashboard/agents/new" className="text-gray-400 hover:text-purple-400 transition-colors">
              → Create Agent
            </Link>
            <Link href="/dashboard/agents" className="text-gray-400 hover:text-purple-400 transition-colors">
              → My Agents
            </Link>
            <Link href="/" className="text-gray-400 hover:text-purple-400 transition-colors">
              → Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
