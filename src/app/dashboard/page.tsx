import { createClient } from '@/lib/supabase/server';
import { getAgents, getProfile, getUsageLast30Days } from '@/lib/db';
import { PLAN_LIMITS } from '@/lib/types';
import type { Plan, Agent } from '@/lib/types';
import { FACE_THUMBNAILS } from '@/lib/constants';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Bot, ArrowRight, Code, Zap, MessageSquare } from 'lucide-react';

const TEMPLATE_FACES = Object.entries(FACE_THUMBNAILS).map(([id, data]) => ({
  id,
  ...data,
}));

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

  const [agents, profile, usageData] = await Promise.all([
    getAgents(user!.id),
    getProfile(user!.id),
    getUsageLast30Days(user!.id),
  ]);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const plan = (profile?.plan || 'starter') as Plan;
  const planLimit = PLAN_LIMITS[plan].queriesPerDay;
  const queriesToday = profile?.queries_today || 0;

  // Compute last 7 days for the mini chart
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
    <div className="max-w-6xl mx-auto px-8 py-10">
      {/* ─── Section A: Greeting Header ─── */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-[#6B7280] mb-2">
          Talk to Site
        </p>
        <h1 className="text-3xl font-semibold text-white">
          {getGreeting()},{' '}
          <span className="capitalize">{displayName}</span>
        </h1>
      </div>

      {/* ─── Section B: Your Agents (Persona Templates) ─── */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-white mb-5">
          {agents.length > 0 ? 'Your Agents' : 'Persona Templates'}
        </h2>
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
          {agents.length > 0 ? (
            <>
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </>
          ) : (
            <>
              {TEMPLATE_FACES.map((face) => (
                <Link
                  key={face.id}
                  href={`/dashboard/agents/new?face=${face.id}`}
                  className="group flex-shrink-0 w-[168px] cursor-pointer"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 ring-1 ring-[#1F1F1F] transition-all group-hover:ring-2 group-hover:ring-orange-500/50">
                    <Image
                      src={face.src}
                      alt={face.label}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="168px"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>
                  <p className="text-sm font-medium text-white truncate">{face.label}</p>
                </Link>
              ))}
            </>
          )}

          {/* Create Your Own */}
          <Link
            href="/dashboard/agents/new"
            className="group flex-shrink-0 w-[168px] cursor-pointer"
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 border-2 border-dashed border-[#2A2A2A] flex items-center justify-center bg-[#111111] transition-all group-hover:border-orange-500/50 group-hover:bg-[#1A1A1A]">
              <div className="w-14 h-14 rounded-full bg-[#1A1A1A] flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                <Plus className="w-7 h-7 text-[#4B5563] group-hover:text-orange-400 transition-colors" />
              </div>
            </div>
            <p className="text-sm text-[#6B7280] group-hover:text-white transition-colors">
              Create Your Own
            </p>
          </Link>
        </div>
      </div>

      {/* ─── Section C: Two-Column Bottom ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Getting Started */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-6">
          <h3 className="text-lg font-medium text-white mb-2">Getting Started</h3>
          <p className="text-sm text-[#9CA3AF] mb-6">
            Create your first AI voice agent in three simple steps.
          </p>

          <div className="space-y-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Code className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Paste a website URL</p>
                <p className="text-xs text-[#6B7280]">We crawl and index your content automatically</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Choose a persona</p>
                <p className="text-xs text-[#6B7280]">Pick an avatar, voice, and greeting message</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Embed on your site</p>
                <p className="text-xs text-[#6B7280]">Add one line of code and you&apos;re live</p>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-400 hover:bg-orange-500/20 transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Usage Overview */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-medium text-white">Usage Overview</h3>
            <span className="text-xs font-medium text-[#6B7280] capitalize px-2 py-1 rounded-md bg-[#1A1A1A] border border-[#2A2A2A]">
              {plan} plan
            </span>
          </div>
          <p className="text-sm text-[#6B7280] mb-6">Last 30 days</p>

          {/* Today's queries progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#9CA3AF]">Queries today</span>
              <span className="text-sm font-medium text-white">
                {queriesToday} / {planLimit === 999999 ? '∞' : planLimit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#1A1A1A] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
                style={{
                  width: `${planLimit === 999999 ? 0 : Math.min(100, (queriesToday / planLimit) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* 7-day mini bar chart */}
          <div className="mb-6">
            <p className="text-xs text-[#6B7280] mb-3">Daily queries (last 7 days)</p>
            <div className="flex items-end gap-1.5 h-20">
              {last7Days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-sm bg-orange-500/50 transition-all hover:bg-orange-500/80"
                    style={{
                      height: `${Math.max(3, (day.queries_count / maxQueries) * 100)}%`,
                      minHeight: '3px',
                    }}
                  />
                  <span className="text-[10px] text-[#4B5563]">{getDayLabel(day.date)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1F1F1F]">
            <div>
              <p className="text-2xl font-semibold text-white">{totalQueries30d}</p>
              <p className="text-xs text-[#6B7280]">Total queries</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{totalConversations30d}</p>
              <p className="text-xs text-[#6B7280]">Conversations</p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/analytics"
              className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-orange-400 transition-colors"
            >
              View Details
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Card Component ───
function AgentCard({ agent }: { agent: Agent }) {
  const face = FACE_THUMBNAILS[agent.avatar_face_id];

  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="group flex-shrink-0 w-[168px] cursor-pointer"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 ring-1 ring-[#1F1F1F] transition-all group-hover:ring-2 group-hover:ring-orange-500/50">
        {face ? (
          <Image
            src={face.src}
            alt={agent.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="168px"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-900/20 to-[#111111] flex items-center justify-center">
            <Bot className="w-10 h-10 text-orange-500/40" />
          </div>
        )}

        {/* Status indicator */}
        <div
          className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ring-2 ring-black/50 ${
            agent.status === 'ready'
              ? 'bg-green-400'
              : agent.status === 'error'
                ? 'bg-red-400'
                : 'bg-orange-400'
          }`}
        />

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
      <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
        {agent.name}
      </p>
      <p className="text-xs text-[#6B7280] truncate">{agent.website_url}</p>
    </Link>
  );
}
