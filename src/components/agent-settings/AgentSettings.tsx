'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Trash2 } from 'lucide-react';
import type { Agent, KnowledgePage } from '@/lib/types';
import { GeneralTab } from './GeneralTab';
import { KnowledgeBaseTab } from './KnowledgeBaseTab';
import { VoiceAvatarTab } from './VoiceAvatarTab';
import { WidgetTab } from './WidgetTab';

type Tab = 'general' | 'knowledge' | 'voice-avatar' | 'widget';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'knowledge', label: 'Knowledge Base' },
  { id: 'voice-avatar', label: 'Voice & Avatar' },
  { id: 'widget', label: 'Widget' },
];

interface AgentSettingsProps {
  agent: Agent;
  knowledgePages: KnowledgePage[];
}

export function AgentSettings({ agent: initialAgent, knowledgePages }: AgentSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [agent, setAgent] = useState<Agent>(initialAgent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Auto-save with debounce
  const saveAgent = useCallback(async (updates: Partial<Agent>) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [agent.id]);

  const handleFieldChange = useCallback((field: keyof Agent, value: string | boolean | number) => {
    setAgent((prev) => ({ ...prev, [field]: value }));
    setSaveStatus('unsaved');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveAgent({ [field]: value });
    }, 1500);
  }, [saveAgent]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this agent? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      router.push('/dashboard/agents');
    } catch {
      setDeleting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/agents"
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{agent.name}</h1>
            <p className="text-sm text-text-muted">{agent.website_url}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          <span className={`flex items-center gap-1.5 text-xs font-medium ${
            saveStatus === 'saved' ? 'text-success' :
            saveStatus === 'saving' ? 'text-text-muted' :
            saveStatus === 'error' ? 'text-error' :
            'text-warning'
          }`}>
            {saveStatus === 'saved' && <><Check className="h-3 w-3" /> Saved</>}
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
            {saveStatus === 'error' && 'Save failed'}
          </span>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-error/30 bg-error/10 p-2 text-error transition-colors hover:bg-error/20 disabled:opacity-50"
            title="Delete agent"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-8 border-b border-border-default">
        <div className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <GeneralTab agent={agent} onChange={handleFieldChange} />
      )}
      {activeTab === 'knowledge' && (
        <KnowledgeBaseTab agent={agent} knowledgePages={knowledgePages} />
      )}
      {activeTab === 'voice-avatar' && (
        <VoiceAvatarTab agent={agent} onChange={handleFieldChange} />
      )}
      {activeTab === 'widget' && (
        <WidgetTab agent={agent} onChange={handleFieldChange} />
      )}
    </div>
  );
}
