'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, FileText, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import type { Agent, KnowledgePage } from '@/lib/types';

interface KnowledgeBaseTabProps {
  agent: Agent;
  knowledgePages: KnowledgePage[];
}

const statusIcon: Record<string, React.ReactNode> = {
  embedded: <CheckCircle className="h-4 w-4 text-success" />,
  chunked: <CheckCircle className="h-4 w-4 text-success" />,
  pending: <Loader2 className="h-4 w-4 animate-spin text-warning" />,
  error: <AlertCircle className="h-4 w-4 text-error" />,
};

export function KnowledgeBaseTab({ agent, knowledgePages }: KnowledgeBaseTabProps) {
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState('');

  const handleRecrawl = async () => {
    setCrawling(true);
    setCrawlError('');
    try {
      const res = await fetch(`/api/agents/${agent.id}/crawl`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setCrawlError(data.error || 'Crawl failed');
      } else {
        // Reload to show updated status
        window.location.reload();
      }
    } catch {
      setCrawlError('Failed to start crawl');
    } finally {
      setCrawling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-2xl font-semibold text-text-primary">{agent.pages_crawled}</p>
          <p className="text-xs text-text-muted">Pages crawled</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-text-primary">{agent.chunks_created}</p>
          <p className="text-xs text-text-muted">Chunks indexed</p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">
            {agent.last_crawled_at
              ? `Last crawled ${new Date(agent.last_crawled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Never crawled'}
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleRecrawl}
            disabled={crawling || agent.status === 'crawling' || agent.status === 'processing'}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recrawl
          </button>
        </div>
      </div>

      {crawlError && (
        <div className="rounded-lg border border-error/20 bg-error/10 p-3 text-sm text-error">{crawlError}</div>
      )}

      {/* Pages list */}
      <div className="rounded-xl border border-border-default bg-bg-surface">
        <div className="border-b border-border-default px-5 py-3">
          <h3 className="text-sm font-medium text-text-secondary">
            Crawled Pages ({knowledgePages.length})
          </h3>
        </div>

        {knowledgePages.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">No pages crawled yet.</p>
            <p className="text-xs text-text-muted">Click &quot;Recrawl&quot; to index your website.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {knowledgePages.map((page) => (
              <div key={page.id} className="flex items-center gap-3 px-5 py-3">
                {statusIcon[page.status] || statusIcon.pending}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">
                    {page.page_title || page.source_url}
                  </p>
                  <p className="truncate text-xs text-text-muted">{page.source_url}</p>
                </div>
                <span className="text-xs text-text-muted">
                  {page.chunk_count} chunks
                </span>
                <a
                  href={page.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted transition-colors hover:text-text-secondary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
