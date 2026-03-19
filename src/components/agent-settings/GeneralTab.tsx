'use client';

import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Agent } from '@/lib/types';

interface GeneralTabProps {
  agent: Agent;
  onChange: (field: keyof Agent, value: string | boolean | number) => void;
}

export function GeneralTab({ agent, onChange }: GeneralTabProps) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/regenerate-prompt`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.system_prompt) {
          onChange('system_prompt', data.system_prompt);
        }
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Agent Name */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Agent Name</label>
        <input
          type="text"
          value={agent.name}
          onChange={(e) => onChange('name', e.target.value)}
          className="w-full rounded-lg border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        />
      </div>

      {/* Website URL (read-only) */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Website URL</label>
        <input
          type="text"
          value={agent.website_url}
          readOnly
          className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-3 text-sm text-text-muted"
        />
        <p className="mt-1.5 text-xs text-text-muted">URL cannot be changed after creation. Delete and recreate if needed.</p>
      </div>

      {/* Greeting Message */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Greeting Message</label>
        <textarea
          value={agent.greeting_message}
          onChange={(e) => onChange('greeting_message', e.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
          placeholder="Hi! How can I help you today?"
        />
        <p className="mt-1.5 text-xs text-text-muted">First message visitors see when they open the widget.</p>
      </div>

      {/* System Prompt */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-text-secondary">System Prompt</label>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
        </div>
        <textarea
          value={agent.system_prompt}
          onChange={(e) => onChange('system_prompt', e.target.value)}
          rows={12}
          className="w-full resize-y rounded-lg border border-border-default bg-bg-surface px-4 py-3 font-mono text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-accent"
        />
        <p className="mt-1.5 text-xs text-text-muted">
          Controls how the agent responds. Auto-generated from your website content.
        </p>
      </div>
    </div>
  );
}
