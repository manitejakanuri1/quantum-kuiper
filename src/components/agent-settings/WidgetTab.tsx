'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { Agent } from '@/lib/types';

interface WidgetTabProps {
  agent: Agent;
  onChange: (field: keyof Agent, value: string | boolean | number) => void;
}

export function WidgetTab({ agent, onChange }: WidgetTabProps) {
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://talktosite.com';
  const embedCode = `<script src="${origin}/widget.js" data-agent-id="${agent.id}"><\/script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Widget Title */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Widget Title</label>
        <input
          type="text"
          value={agent.widget_title}
          onChange={(e) => onChange('widget_title', e.target.value)}
          className="w-full rounded-lg border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
          placeholder="Chat with us"
        />
      </div>

      {/* Widget Color */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Widget Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={agent.widget_color}
            onChange={(e) => onChange('widget_color', e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border-default bg-transparent"
          />
          <input
            type="text"
            value={agent.widget_color}
            onChange={(e) => onChange('widget_color', e.target.value)}
            className="w-32 rounded-lg border border-border-default bg-bg-surface px-4 py-2.5 font-mono text-sm text-text-primary outline-none focus:border-accent"
            placeholder="#3b82f6"
          />
        </div>
      </div>

      {/* Widget Position */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Widget Position</label>
        <div className="flex gap-3">
          {(['bottom-right', 'bottom-left'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => onChange('widget_position', pos)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                agent.widget_position === pos
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border-default bg-bg-surface text-text-secondary hover:border-border-hover'
              }`}
            >
              {pos === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
            </button>
          ))}
        </div>
      </div>

      {/* Embed Code */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-text-secondary">Embed Code</label>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
          >
            {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border-default bg-bg-base p-4 font-mono text-xs leading-relaxed text-text-secondary">
          {embedCode}
        </pre>
        <p className="mt-2 text-xs text-text-muted">
          Paste this code before the closing &lt;/body&gt; tag on your website.
        </p>
      </div>

      {/* Preview */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text-secondary">Live Preview</label>
        <div className="overflow-hidden rounded-xl border border-border-default bg-bg-base">
          <iframe
            src={`/widget/${agent.id}`}
            className="h-[500px] w-full border-0"
            allow="microphone"
          />
        </div>
      </div>
    </div>
  );
}
