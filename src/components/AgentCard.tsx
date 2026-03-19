'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Bot, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { Agent } from '@/lib/types';
import { FACE_THUMBNAILS } from '@/lib/constants';

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  ready: { label: 'Active', color: 'text-success', dot: 'bg-success' },
  crawling: { label: 'Crawling', color: 'text-warning', dot: 'bg-warning' },
  processing: { label: 'Processing', color: 'text-warning', dot: 'bg-warning' },
  pending: { label: 'Pending', color: 'text-text-muted', dot: 'bg-text-muted' },
  error: { label: 'Error', color: 'text-error', dot: 'bg-error' },
};

export function AgentCard({ agent }: { agent: Agent }) {
  const [copied, setCopied] = useState(false);
  const face = FACE_THUMBNAILS[agent.avatar_face_id];
  const status = statusConfig[agent.status] || statusConfig.pending;

  const embedCode = `<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/widget.js" data-agent-id="${agent.id}"><\/script>`;

  const handleCopyEmbed = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group rounded-xl border border-border-default bg-bg-surface transition-all hover:border-border-hover hover:shadow-lg">
      <Link href={`/dashboard/agents/${agent.id}`} className="block p-5">
        {/* Header row */}
        <div className="mb-4 flex items-start gap-3">
          {/* Avatar */}
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
            {face ? (
              <Image
                src={face.src}
                alt={agent.name}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent-muted">
                <Bot className="h-6 w-6 text-accent" />
              </div>
            )}
          </div>

          {/* Name + URL */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
              {agent.name}
            </h3>
            <p className="truncate text-xs text-text-muted">{agent.website_url}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>{agent.pages_crawled} pages</span>
          <span>{agent.chunks_created} chunks</span>
          {agent.last_crawled_at && (
            <span suppressHydrationWarning>
              Updated {new Date(agent.last_crawled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </Link>

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t border-border-default px-5 py-3">
        <Link
          href={`/widget/${agent.id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <ExternalLink className="h-3 w-3" />
          Test Agent
        </Link>
        <button
          onClick={handleCopyEmbed}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Get Embed Code
            </>
          )}
        </button>
      </div>
    </div>
  );
}
