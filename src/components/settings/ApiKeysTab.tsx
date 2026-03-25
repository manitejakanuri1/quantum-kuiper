'use client';

import { Key, Lock, ExternalLink } from 'lucide-react';

export function ApiKeysTab() {
  return (
    <div className="space-y-6">
      {/* Coming Soon */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
          <Key className="h-8 w-8 text-accent" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-text-primary">API Access</h2>
        <p className="mx-auto mb-6 max-w-sm text-sm text-text-secondary">
          Programmatic access to your agents is coming soon. You&apos;ll be able to integrate Talk to Site directly into your applications.
        </p>

        <div className="mx-auto max-w-md space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-bg-base p-3 text-left">
            <Lock className="h-5 w-5 shrink-0 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">REST API</p>
              <p className="text-xs text-text-muted">Send queries and get responses programmatically</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-bg-base p-3 text-left">
            <Lock className="h-5 w-5 shrink-0 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">Webhooks</p>
              <p className="text-xs text-text-muted">Get notified when conversations happen</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-bg-base p-3 text-left">
            <Lock className="h-5 w-5 shrink-0 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">Widget SDK</p>
              <p className="text-xs text-text-muted">Advanced widget customization via JavaScript</p>
            </div>
          </div>
        </div>

        <a
          href="mailto:support@talktosite.com?subject=API Access Interest"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        >
          Request Early Access
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
