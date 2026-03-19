'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-6">
      <div className="w-full max-w-2xl text-center">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="animate-gradient-text text-9xl font-black">
            404
          </h1>
        </div>

        {/* Icon */}
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
            <Search className="h-10 w-10 text-accent" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-4 text-3xl font-bold text-text-primary">
          Page Not Found
        </h2>

        {/* Description */}
        <p className="mb-8 text-lg text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-default bg-bg-elevated px-6 py-3 font-semibold text-text-primary transition-colors hover:border-border-hover hover:bg-bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>

          <Link
            href="/"
            className="glow-accent flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Home className="h-5 w-5" />
            Go Home
          </Link>
        </div>

        {/* Popular Links */}
        <div className="glass mt-12 rounded-xl p-6">
          <h3 className="mb-4 font-semibold text-text-primary">Popular Pages</h3>
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            <Link href="/dashboard" className="text-text-secondary transition-colors hover:text-accent">
              → Dashboard
            </Link>
            <Link href="/dashboard/agents/new" className="text-text-secondary transition-colors hover:text-accent">
              → Create Agent
            </Link>
            <Link href="/dashboard/agents" className="text-text-secondary transition-colors hover:text-accent">
              → My Agents
            </Link>
            <Link href="/" className="text-text-secondary transition-colors hover:text-accent">
              → Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
