import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAgents } from '@/lib/db';
import { FACE_THUMBNAILS } from '@/lib/constants';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Bot } from 'lucide-react';
import type { Agent } from '@/lib/types';

export default async function AgentsListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const agents = await getAgents(user.id);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Agents</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] bg-[#141414] p-16 text-center">
          <Bot className="w-12 h-12 text-[#4B5563] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No agents yet</h3>
          <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto">
            Create your first AI voice agent to start answering questions from your website visitors.
          </p>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-5 py-2.5 text-sm font-medium text-orange-400 hover:bg-orange-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {agents.map((agent) => (
            <AgentGridCard key={agent.id} agent={agent} />
          ))}
          <Link
            href="/dashboard/agents/new"
            className="group cursor-pointer"
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 border-2 border-dashed border-[#2A2A2A] flex items-center justify-center bg-[#111111] transition-all group-hover:border-orange-500/50 group-hover:bg-[#1A1A1A]">
              <div className="w-14 h-14 rounded-full bg-[#1A1A1A] flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                <Plus className="w-7 h-7 text-[#4B5563] group-hover:text-orange-400 transition-colors" />
              </div>
            </div>
            <p className="text-sm text-[#6B7280] group-hover:text-white transition-colors">
              New Agent
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}

function AgentGridCard({ agent }: { agent: Agent }) {
  const face = FACE_THUMBNAILS[agent.avatar_face_id];

  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 ring-1 ring-[#1F1F1F] transition-all group-hover:ring-2 group-hover:ring-orange-500/50">
        {face ? (
          <Image
            src={face.src}
            alt={agent.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="200px"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-900/20 to-[#111111] flex items-center justify-center">
            <Bot className="w-10 h-10 text-orange-500/40" />
          </div>
        )}

        <div
          className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ring-2 ring-black/50 ${
            agent.status === 'ready'
              ? 'bg-green-400'
              : agent.status === 'error'
                ? 'bg-red-400'
                : 'bg-orange-400'
          }`}
        />

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
      <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
        {agent.name}
      </p>
      <p className="text-xs text-[#6B7280] truncate">{agent.website_url}</p>
    </Link>
  );
}
