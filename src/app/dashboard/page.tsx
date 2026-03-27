import { createClient } from '@/lib/supabase/server';
import { getAgents, getProfile, getUsageLast30Days } from '@/lib/db';
import { PLAN_LIMITS } from '@/lib/types';
import type { Plan, Agent } from '@/lib/types';
import Link from 'next/link';
import { Plus, Bot, ArrowRight, Code, Zap, MessageSquare } from 'lucide-react';
import { AgentCard } from '@/components/AgentCard';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let agents: Agent[] = [];
  let profile: Awaited<ReturnType<typeof getProfile>> = null;
  let usageData: Awaited<ReturnType<typeof getUsageLast30Days>> = [];
  try {
    [agents, profile, usageData] = await Promise.all([
      getAgents(user!.id),
      getProfile(user!.id),
      getUsageLast30Days(user!.id),
    ]);
  } catch (err) {
    console.error('[Dashboard] Failed to load data:', err);
  }

  // Generate signed URLs for custom face previews
  for (const agent of agents) {
    if (agent.custom_face_status === 'ready' && agent.custom_face_image_url && !agent.custom_face_image_url.startsWith('http')) {
      const { data } = await supabase.storage.from('agent-faces').createSignedUrl(agent.custom_face_image_url, 3600);
      if (data?.signedUrl) agent.custom_face_image_url = data.signedUrl;
    }
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const plan = (profile?.plan || 'starter') as Plan;
  const planLimit = PLAN_LIMITS[plan].queriesPerDay;
  const queriesToday = profile?.queries_today || 0;

  const last7Days = (() => {
    const days: { queries_count: number; conversations_count: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = usageData.find((u) => u.date === dateStr);
      days.push({
        queries_count: found?.queries_count || 0,
        conversations_count: found?.conversations_count || 0,
        date: dateStr,
      });
    }
    return days;
  })();

  const maxQueries = Math.max(...last7Days.map((d) => d.queries_count), 1);
  const totalQueries30d = usageData.reduce((sum, d) => sum + d.queries_count, 0);
  const totalConversations30d = usageData.reduce((sum, d) => sum + d.conversations_count, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      {/* Greeting */}
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-text-muted">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold text-text-primary">
          {getGreeting()},{' '}
          <span className="capitalize">{displayName}</span>
        </h1>
      </div>

      {/* Agents Section */}
      <div className="mb-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-medium text-text-primary">
            {agents.length > 0 ? 'Your Agents' : 'Get Started'}
          </h2>
          {agents.length > 0 && (
            <Link href="/dashboard/agents" className="text-sm text-accent hover:underline">
              View all
            </Link>
          )}
        </div>

        {agents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.slice(0, 3).map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-hover bg-bg-surface p-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-muted">
              <Bot className="h-8 w-8 text-accent" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-text-primary">Create your first agent</h3>
            <p className="mx-auto mb-6 max-w-sm text-sm text-text-secondary">
              Paste a website URL and we&apos;ll create an AI voice agent that knows everything about your business.
            </p>
            <Link
              href="/dashboard/agents/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Create Agent
            </Link>
          </div>
        )}
      </div>

      {/* Two-Column Bottom */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Getting Started */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-6">
          <h3 className="mb-2 text-lg font-medium text-text-primary">Quick Start Guide</h3>
          <p className="mb-6 text-sm text-text-secondary">
            Create your first AI voice agent in three simple steps.
          </p>

          <div className="mb-6 space-y-5">
            {[
              { icon: Code, title: 'Paste a website URL', desc: 'We crawl and index your content automatically' },
              { icon: Zap, title: 'Choose a persona', desc: 'Pick an avatar, voice, and greeting message' },
              { icon: MessageSquare, title: 'Embed on your site', desc: 'Add one line of code and you\'re live' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-muted">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-muted px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Usage Overview */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-6">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-lg font-medium text-text-primary">Usage Overview</h3>
            <span className="rounded-md border border-border-default bg-bg-elevated px-2 py-1 text-xs font-medium capitalize text-text-muted">
              {plan} plan
            </span>
          </div>
          <p className="mb-6 text-sm text-text-muted">Last 30 days</p>

          {/* Today's queries */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-text-secondary">Queries today</span>
              <span className="text-sm font-medium text-text-primary">
                {queriesToday} / {planLimit === 999999 ? '\u221E' : planLimit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{
                  width: `${planLimit === 999999 ? 0 : Math.min(100, (queriesToday / planLimit) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* 7-day mini bar chart */}
          <div className="mb-6">
            <p className="mb-3 text-xs text-text-muted">Daily queries (last 7 days)</p>
            <div className="flex h-20 items-end gap-1.5">
              {last7Days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-sm bg-accent/40 transition-all hover:bg-accent/70"
                    style={{
                      height: `${Math.max(3, (day.queries_count / maxQueries) * 100)}%`,
                      minHeight: '3px',
                    }}
                  />
                  <span className="text-[10px] text-text-muted">{getDayLabel(day.date)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 border-t border-border-default pt-4">
            <div>
              <p className="text-2xl font-semibold text-text-primary">{totalQueries30d}</p>
              <p className="text-xs text-text-muted">Total queries</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-text-primary">{totalConversations30d}</p>
              <p className="text-xs text-text-muted">Conversations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
