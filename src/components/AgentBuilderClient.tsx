'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  Loader2,
  Bot,
  AlertCircle,
  FileText,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Code,
  Copy,
  CheckCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Agent, KnowledgePage } from '@/lib/types';
import {
  FACE_THUMBNAILS,
  DEFAULT_FACE_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_GREETING,
  DEFAULT_SYSTEM_PROMPT,
  generateSystemPrompt,
} from '@/lib/constants';
import { FaceGallery } from '@/components/FaceGallery';
import { VoiceSelector } from '@/components/VoiceSelector';

// Dynamic import — Simli uses WebRTC which requires browser APIs
const AvatarInteraction = dynamic(() => import('@/components/AvatarInteraction'), {
  ssr: false,
});

type Tab = 'prompt' | 'avatar' | 'voice' | 'knowledge' | 'embed';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface AgentBuilderClientProps {
  agent: Agent | null;
  knowledgePages?: KnowledgePage[];
  initialFaceId?: string;
}

// ─── Toggle ───
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-orange-500' : 'bg-[#2A2A2A]'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  );
}

export default function AgentBuilderClient({
  agent,
  knowledgePages = [],
  initialFaceId,
}: AgentBuilderClientProps) {
  const router = useRouter();
  const isEditMode = !!agent;

  const [activeTab, setActiveTab] = useState<Tab>('prompt');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isCreating, setIsCreating] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  const [form, setForm] = useState({
    name: agent?.name || '',
    website_url: agent?.website_url || '',
    greeting_message: agent?.greeting_message || DEFAULT_GREETING,
    system_prompt: agent?.system_prompt || DEFAULT_SYSTEM_PROMPT,
    voice_id: agent?.voice_id || DEFAULT_VOICE_ID,
    avatar_face_id: agent?.avatar_face_id || initialFaceId || DEFAULT_FACE_ID,
    avatar_enabled: agent?.avatar_enabled ?? true,
    widget_color: agent?.widget_color || '#F97316',
    widget_position: (agent?.widget_position || 'bottom-right') as 'bottom-right' | 'bottom-left',
    widget_title: agent?.widget_title || agent?.name || '',
  });

  const prevFormRef = useRef(form);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const userEditedPromptRef = useRef(!!agent); // Don't auto-generate in edit mode

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    // Track if user manually edited the system prompt
    if (key === 'system_prompt') {
      userEditedPromptRef.current = true;
      // In edit mode, mark as customized in DB
      if (isEditMode && agent) {
        fetch(`/api/agents/${agent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt_customized: true }),
        }).catch(console.error);
      }
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }, [isEditMode, agent]);

  // ─── Auto-generate system prompt + greeting (create mode only) ───
  useEffect(() => {
    if (isEditMode || userEditedPromptRef.current) return;
    if (form.name.trim() && form.website_url.trim()) {
      try {
        new URL(form.website_url);
        const prompt = generateSystemPrompt(form.name.trim(), form.website_url.trim());
        let domain = '';
        try { domain = new URL(form.website_url).hostname.replace('www.', ''); } catch { /* */ }
        const greeting = `Hi! I'm ${form.name.trim()}, the AI assistant for ${domain || 'this website'}. How can I help you today?`;
        setForm((prev) => ({ ...prev, system_prompt: prompt, greeting_message: greeting }));
      } catch {
        // Invalid URL — keep defaults
      }
    }
  }, [form.name, form.website_url, isEditMode]);

  // ─── Auto-save (edit mode only) ───
  useEffect(() => {
    if (!agent) return;

    const diff: Record<string, unknown> = {};
    for (const key of Object.keys(form) as (keyof typeof form)[]) {
      if (form[key] !== prevFormRef.current[key]) {
        diff[key] = form[key];
      }
    }
    if (Object.keys(diff).length === 0) return;

    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) return; // Skip if already saving
      isSavingRef.current = true;
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/agents/${agent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(diff),
        });
        if (res.ok) {
          setSaveStatus('saved');
          prevFormRef.current = { ...form };
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [form, agent]);

  // ─── Create agent ───
  const handleCreate = async () => {
    if (!form.name.trim() || !form.website_url.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const { agent: newAgent } = await res.json();
        // Auto-trigger crawl (fire-and-forget)
        fetch(`/api/agents/${newAgent.id}/crawl`, { method: 'POST' }).catch(console.error);
        router.push(`/dashboard/agents/${newAgent.id}`);
      }
    } catch (err) {
      console.error('[AgentBuilder] Create failed:', err);
      setSaveStatus('error');
    } finally {
      setIsCreating(false);
    }
  };

  const currentFace = FACE_THUMBNAILS[form.avatar_face_id];

  const tabs: { key: Tab; label: string; editOnly?: boolean }[] = [
    { key: 'prompt', label: 'Prompt' },
    { key: 'avatar', label: 'Avatar' },
    { key: 'voice', label: 'Voice' },
    { key: 'knowledge', label: 'Knowledge', editOnly: true },
    { key: 'embed', label: 'Embed', editOnly: true },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F1F] bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href={isEditMode ? '/dashboard/agents' : '/dashboard'}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {isEditMode ? (
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-white">{agent.name}</h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  agent.status === 'ready'
                    ? 'bg-green-500/10 text-green-400'
                    : agent.status === 'error'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-orange-500/10 text-orange-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    agent.status === 'ready'
                      ? 'bg-green-400'
                      : agent.status === 'error'
                        ? 'bg-red-400'
                        : 'bg-orange-400'
                  }`}
                />
                {agent.status}
              </span>
            </div>
          ) : (
            <h1 className="text-lg font-medium text-white">New Agent</h1>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isEditMode && (
            <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              {saveStatus === 'saved' && <><Check className="w-3.5 h-3.5 text-green-400" /> Saved</>}
              {saveStatus === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>}
              {saveStatus === 'unsaved' && <>Unsaved changes</>}
              {saveStatus === 'error' && <><AlertCircle className="w-3.5 h-3.5 text-red-400" /> Save failed</>}
            </span>
          )}
          {!isEditMode && (
            <button
              onClick={handleCreate}
              disabled={isCreating || !form.name.trim() || !form.website_url.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Agent
            </button>
          )}
          {isEditMode && (
            <button
              disabled
              className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
              title="Coming soon"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* ─── Main Content: Two Panels ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Config */}
        <div className="flex-1 overflow-y-auto">
          {/* Tab Bar */}
          <div className="flex gap-6 px-6 pt-6 border-b border-[#1F1F1F]">
            {tabs.map((tab) => {
              if (tab.editOnly && !isEditMode) return null;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-white border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-6 max-w-lg">
            {activeTab === 'prompt' && (
              <PromptTab
                form={form}
                updateField={updateField}
                isEditMode={isEditMode}
                agentId={agent?.id}
                agentStatus={agent?.status}
                promptGeneratedAt={agent?.prompt_generated_at}
                promptCustomized={agent?.prompt_customized}
                onPromptRegenerated={(newPrompt, newGreeting) => {
                  setForm((prev) => ({ ...prev, system_prompt: newPrompt, greeting_message: newGreeting }));
                  prevFormRef.current = { ...prevFormRef.current, system_prompt: newPrompt, greeting_message: newGreeting };
                  router.refresh();
                }}
              />
            )}
            {activeTab === 'avatar' && (
              <AvatarTab
                selectedFaceId={form.avatar_face_id}
                avatarEnabled={form.avatar_enabled}
                onSelectFace={(id) => updateField('avatar_face_id', id)}
                onToggleAvatar={(v) => updateField('avatar_enabled', v)}
              />
            )}
            {activeTab === 'voice' && (
              <VoiceTab
                selectedVoice={form.voice_id}
                onSelect={(id) => updateField('voice_id', id)}
              />
            )}
            {activeTab === 'knowledge' && isEditMode && (
              <KnowledgeTab
                knowledgePages={knowledgePages}
                websiteUrl={agent.website_url}
                pagesCrawled={agent.pages_crawled}
                agentId={agent.id}
                agentStatus={agent.status}
                onCrawlComplete={() => router.refresh()}
              />
            )}
            {activeTab === 'embed' && isEditMode && (
              <EmbedTab
                agentId={agent.id}
                agentName={agent.name}
                agentStatus={agent.status}
                widgetColor={form.widget_color}
                widgetPosition={form.widget_position}
                widgetTitle={form.widget_title}
                onUpdateColor={(c) => updateField('widget_color', c)}
                onUpdatePosition={(p) => updateField('widget_position', p as 'bottom-right' | 'bottom-left')}
                onUpdateTitle={(t) => updateField('widget_title', t)}
              />
            )}
          </div>
        </div>

        {/* Right Panel — Avatar Preview / Test Mode */}
        <div className="hidden lg:flex w-[400px] xl:w-[480px] flex-col items-center justify-center border-l border-[#1F1F1F] bg-[#0D0D0D] p-8">
          <div className="w-full max-w-[360px]">
            {isTestMode && isEditMode && agent ? (
              /* ─── Live Test Mode ─── */
              <AvatarInteraction
                agentId={agent.id}
                simli_faceid={form.avatar_face_id}
                voiceId={form.voice_id}
                facePreviewUrl={currentFace?.src}
                agentName={agent.name}
                avatarEnabled={form.avatar_enabled}
                initialPrompt={form.greeting_message}
                onStop={() => setIsTestMode(false)}
              />
            ) : (
              /* ─── Static Preview ─── */
              <>
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden ring-1 ring-[#1F1F1F] bg-[#111111]">
                  {currentFace ? (
                    <Image
                      src={currentFace.src}
                      alt={currentFace.name}
                      fill
                      className="object-cover"
                      sizes="400px"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/20 to-[#111111]">
                      <Bot className="w-16 h-16 text-orange-500/30" />
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-center">
                  {isEditMode && agent?.status === 'ready' ? (
                    <button
                      onClick={() => setIsTestMode(true)}
                      className="rounded-lg bg-orange-500 hover:bg-orange-600 px-8 py-2.5 text-sm font-medium text-white transition-colors"
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      disabled
                      className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-8 py-2.5 text-sm font-medium text-gray-400 cursor-not-allowed"
                      title={!isEditMode ? 'Create agent first' : 'Agent must be ready (crawl website first)'}
                    >
                      {!isEditMode ? 'Create First' : agent?.status === 'crawling' || agent?.status === 'processing' ? 'Processing...' : 'Crawl First'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Prompt Tab ───
function PromptTab({
  form,
  updateField,
  isEditMode,
  agentId,
  agentStatus,
  promptGeneratedAt,
  promptCustomized,
  onPromptRegenerated,
}: {
  form: { name: string; website_url: string; system_prompt: string; greeting_message: string };
  updateField: (key: 'name' | 'website_url' | 'system_prompt' | 'greeting_message', value: string) => void;
  isEditMode: boolean;
  agentId?: string;
  agentStatus?: string;
  promptGeneratedAt?: string | null;
  promptCustomized?: boolean;
  onPromptRegenerated?: (newPrompt: string, newGreeting: string) => void;
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!agentId) return;
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/regenerate-prompt`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setRegenError(data.error || 'Regeneration failed');
        return;
      }
      const data = await res.json();
      onPromptRegenerated?.(data.system_prompt, data.greeting);
    } catch {
      setRegenError('Network error during regeneration');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleReset = () => {
    const defaultPrompt = 'You are a helpful customer support agent. Answer questions based only on the provided context. If you don\'t know the answer, say so.';
    const defaultGreeting = 'Hi! How can I help you today?';
    updateField('system_prompt', defaultPrompt);
    updateField('greeting_message', defaultGreeting);
    // Also clear prompt_customized in DB
    if (agentId) {
      fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_customized: false }),
      }).catch(console.error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Agent Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="My Support Agent"
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Website URL</label>
        <input
          type="url"
          value={form.website_url}
          onChange={(e) => updateField('website_url', e.target.value)}
          placeholder="https://example.com"
          disabled={isEditMode}
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors disabled:opacity-50"
        />
        {!isEditMode && (
          <p className="text-xs text-[#6B7280] mt-1.5">We&apos;ll crawl and index this website for your agent.</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">System Prompt</label>
          {isEditMode && promptGeneratedAt && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-400/70">
              <Sparkles className="w-3 h-3" />
              Auto-generated
            </span>
          )}
        </div>
        <textarea
          value={form.system_prompt}
          onChange={(e) => updateField('system_prompt', e.target.value)}
          rows={8}
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors resize-none"
          placeholder="You are a helpful assistant..."
        />
        <p className="text-xs text-[#6B7280] mt-1.5">
          {isEditMode && agentStatus === 'ready'
            ? 'Auto-generated from your website. Edit to customize.'
            : 'Define how your agent should behave and respond to questions.'}
        </p>

        {/* Regenerate / Reset buttons (edit mode, agent ready) */}
        {isEditMode && agentStatus === 'ready' && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 disabled:text-orange-400/50 disabled:cursor-not-allowed"
            >
              {isRegenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {isRegenerating ? 'Regenerating...' : 'Regenerate from website'}
            </button>
            <span className="text-[#2A2A2A]">|</span>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to default
            </button>
          </div>
        )}

        {regenError && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {regenError}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Greeting Message</label>
        <input
          type="text"
          value={form.greeting_message}
          onChange={(e) => updateField('greeting_message', e.target.value)}
          placeholder="Hi! How can I help you today?"
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
        />
        <p className="text-xs text-[#6B7280] mt-1.5">
          The first message your agent sends to visitors.
        </p>
      </div>
    </div>
  );
}

// ─── Avatar Tab ───
function AvatarTab({
  selectedFaceId,
  avatarEnabled,
  onSelectFace,
  onToggleAvatar,
}: {
  selectedFaceId: string;
  avatarEnabled: boolean;
  onSelectFace: (id: string) => void;
  onToggleAvatar: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <Toggle checked={avatarEnabled} onChange={onToggleAvatar} label="Avatar Enabled" />
      {avatarEnabled && (
        <>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">Choose an Avatar</label>
            <FaceGallery selectedFaceId={selectedFaceId} onSelect={onSelectFace} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Voice Tab ───
function VoiceTab({
  selectedVoice,
  onSelect,
}: {
  selectedVoice: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-gray-300 block">Choose a Voice</label>
      <VoiceSelector selectedVoice={selectedVoice} onSelect={onSelect} />
    </div>
  );
}

// ─── Knowledge Tab ───
interface CrawlProgress {
  phase: 'idle' | 'starting' | 'crawling' | 'processing' | 'ready' | 'error';
  completed: number;
  total: number;
  processed: number;
  message: string;
}

function KnowledgeTab({
  knowledgePages,
  websiteUrl,
  pagesCrawled,
  agentId,
  agentStatus,
  onCrawlComplete,
}: {
  knowledgePages: KnowledgePage[];
  websiteUrl: string;
  pagesCrawled: number;
  agentId: string;
  agentStatus: string;
  onCrawlComplete: () => void;
}) {
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CrawlProgress>({
    phase: agentStatus === 'crawling' ? 'crawling' : agentStatus === 'processing' ? 'processing' : 'idle',
    completed: 0,
    total: 0,
    processed: 0,
    message: '',
  });
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // ─── Polling: check crawl status ───
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/crawl/status`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'crawling') {
        setProgress({
          phase: 'crawling',
          completed: data.completed || 0,
          total: data.total || 0,
          processed: 0,
          message: data.total > 0
            ? `Crawling website... ${data.completed}/${data.total} pages found`
            : 'Crawling website...',
        });

        // If Firecrawl is done, trigger processing
        if (data.firecrawlStatus === 'completed') {
          await fetch(`/api/agents/${agentId}/crawl/process`, { method: 'POST' });
        }
      } else if (data.status === 'processing') {
        setProgress({
          phase: 'processing',
          completed: 0,
          total: data.total || 0,
          processed: data.processed || 0,
          message: `Processing pages... ${data.processed || 0}/${data.total || 0} embedded`,
        });

        // Trigger next batch
        const processRes = await fetch(`/api/agents/${agentId}/crawl/process`, { method: 'POST' });
        if (processRes.ok) {
          const processData = await processRes.json();
          if (processData.status === 'ready') {
            setProgress({
              phase: 'ready',
              completed: 0,
              total: processData.processed || 0,
              processed: processData.processed || 0,
              message: `Complete! ${processData.processed} pages indexed`,
            });
            stopPolling();
            onCrawlComplete();
            return;
          }
          // Update progress with latest counts
          setProgress({
            phase: 'processing',
            completed: 0,
            total: processData.total || 0,
            processed: processData.processed || 0,
            message: `Processing pages... ${processData.processed || 0}/${processData.total || 0} embedded`,
          });
        }
      } else if (data.status === 'ready') {
        setProgress({
          phase: 'ready',
          completed: 0,
          total: data.pagesCrawled || 0,
          processed: data.pagesCrawled || 0,
          message: `Complete! ${data.pagesCrawled || 0} pages indexed`,
        });
        stopPolling();
        onCrawlComplete();
        return;
      } else if (data.status === 'error') {
        setProgress({ phase: 'error', completed: 0, total: 0, processed: 0, message: '' });
        setCrawlError(data.error || 'Crawl failed');
        stopPolling();
        return;
      }
    } catch {
      // Network error — keep polling, it'll retry
    }
  }, [agentId, onCrawlComplete]);

  const pollCountRef = useRef(0);

  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    pollCountRef.current = 0;
    const poll = () => {
      pollCountRef.current++;
      pollStatus().finally(() => {
        if (isPollingRef.current) {
          // After 10 polls at 3s, step up to 5s to reduce load
          const interval = pollCountRef.current > 10 ? 5000 : 3000;
          pollingRef.current = setTimeout(poll, interval);
        }
      });
    };
    poll();
  }, [pollStatus]);

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Auto-start polling if agent is already crawling/processing
  useEffect(() => {
    if (agentStatus === 'crawling' || agentStatus === 'processing') {
      startPolling();
    }
    return () => stopPolling();
  }, [agentStatus, startPolling, stopPolling]);

  // ─── Start crawl ───
  const handleCrawl = async () => {
    setCrawlError(null);
    setProgress({ phase: 'starting', completed: 0, total: 0, processed: 0, message: 'Starting crawl...' });

    try {
      const res = await fetch(`/api/agents/${agentId}/crawl`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setCrawlError(data.error || 'Failed to start crawl');
        setProgress({ phase: 'error', completed: 0, total: 0, processed: 0, message: '' });
        return;
      }

      setProgress({ phase: 'crawling', completed: 0, total: 0, processed: 0, message: 'Crawling website...' });
      startPolling();
    } catch {
      setCrawlError('Network error');
      setProgress({ phase: 'error', completed: 0, total: 0, processed: 0, message: '' });
    }
  };

  const isBusy = progress.phase === 'starting' || progress.phase === 'crawling' || progress.phase === 'processing';
  const progressPercent = progress.phase === 'crawling'
    ? (progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0)
    : progress.phase === 'processing'
      ? (progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-300">Knowledge Base</label>
          <span className="text-xs text-[#6B7280]">{pagesCrawled} pages crawled</span>
        </div>

        <div className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300 truncate">
              <ExternalLink className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
              <span className="truncate">{websiteUrl}</span>
            </div>
            <button
              onClick={handleCrawl}
              disabled={isBusy}
              className={`text-xs ${isBusy ? 'text-orange-400/50 cursor-not-allowed' : 'text-orange-400 hover:text-orange-300'}`}
            >
              {isBusy ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {progress.phase === 'processing' ? 'Processing...' : 'Crawling...'}
                </span>
              ) : pagesCrawled > 0 ? 'Re-crawl' : 'Crawl Now'}
            </button>
          </div>

          {/* Progress bar */}
          {isBusy && (
            <div className="mt-3 space-y-2">
              <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(progressPercent, 5)}%` }}
                />
              </div>
              <p className="text-xs text-[#6B7280]">{progress.message}</p>
            </div>
          )}
        </div>

        {crawlError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {crawlError}
          </div>
        )}
      </div>

      {knowledgePages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] p-8 text-center">
          <FileText className="w-8 h-8 text-[#4B5563] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">No pages crawled yet.</p>
          <p className="text-xs text-[#4B5563] mt-1">
            Click &quot;Crawl Now&quot; to index your website content.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {knowledgePages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between rounded-lg border border-[#1F1F1F] bg-[#141414] px-4 py-3"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm text-white truncate">{page.page_title || page.source_url}</p>
                <p className="text-xs text-[#6B7280] truncate">{page.source_url}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-[#6B7280]">{page.chunk_count} chunks</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    page.status === 'embedded'
                      ? 'bg-green-500/10 text-green-400'
                      : page.status === 'error'
                        ? 'bg-red-500/10 text-red-400'
                        : page.status === 'chunked'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-orange-500/10 text-orange-400'
                  }`}
                >
                  {page.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Embed Tab ───
const PRESET_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#EC4899'];

function EmbedTab({
  agentId,
  agentName,
  agentStatus,
  widgetColor,
  widgetPosition,
  widgetTitle,
  onUpdateColor,
  onUpdatePosition,
  onUpdateTitle,
}: {
  agentId: string;
  agentName: string;
  agentStatus: string;
  widgetColor: string;
  widgetPosition: string;
  widgetTitle: string;
  onUpdateColor: (color: string) => void;
  onUpdatePosition: (position: string) => void;
  onUpdateTitle: (title: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com';

  const embedCode = `<script
  src="${origin}/widget.js"
  data-agent-id="${agentId}"
  data-color="${widgetColor}"
  data-position="${widgetPosition}"
  data-title="${widgetTitle}"
  defer
><\/script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isReady = agentStatus === 'ready';

  return (
    <div className="space-y-8">
      {/* Status check */}
      {!isReady && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <AlertCircle className="w-4 h-4" />
            Your agent needs to be ready before embedding. Crawl your website first.
          </div>
        </div>
      )}

      {/* Embed Code */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-4 h-4 text-orange-400" />
          <label className="text-sm font-medium text-gray-300">Embed Code</label>
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          Add this script tag to your website&apos;s HTML, just before the closing <code className="text-orange-400/70">&lt;/body&gt;</code> tag.
        </p>
        <div className="relative">
          <pre className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-4 pr-12 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">
            {embedCode}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 p-1.5 rounded-md bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
        {copied && (
          <p className="text-xs text-green-400 mt-2">Copied to clipboard!</p>
        )}
      </div>

      {/* Widget Customization */}
      <div className="space-y-6">
        <h3 className="text-sm font-medium text-gray-300">Customize Widget</h3>

        {/* Widget Title */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-2 block">Widget Title</label>
          <input
            type="text"
            value={widgetTitle}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder={agentName}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
          />
          <p className="text-xs text-[#6B7280] mt-1">Shown in the widget header bar.</p>
        </div>

        {/* Widget Color */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-2 block">Brand Color</label>
          <div className="flex items-center gap-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onUpdateColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  widgetColor === color
                    ? 'border-white scale-110'
                    : 'border-transparent hover:border-white/30'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={widgetColor}
                onChange={(e) => onUpdateColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-[#2A2A2A]"
                title="Custom color"
              />
            </div>
          </div>
        </div>

        {/* Widget Position */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-2 block">Position</label>
          <div className="flex gap-3">
            {(['bottom-right', 'bottom-left'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => onUpdatePosition(pos)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  widgetPosition === pos
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-400 hover:border-[#3A3A3A] hover:text-gray-300'
                }`}
              >
                {pos === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Link */}
      {isReady && (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Live Preview</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Open the widget page directly to test.</p>
            </div>
            <a
              href={`/widget/${agentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#333333] px-4 py-2 text-sm text-gray-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
