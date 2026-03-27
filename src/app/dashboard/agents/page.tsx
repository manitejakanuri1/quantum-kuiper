import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAgents } from '@/lib/db';
import Link from 'next/link';
import { Plus, Bot } from 'lucide-react';
import { AgentCard } from '@/components/AgentCard';

export default async function AgentsListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const agents = await getAgents(user.id);

  // Generate signed URLs for custom face previews
  for (const agent of agents) {
    if (agent.custom_face_status === 'ready' && agent.custom_face_image_url && !agent.custom_face_image_url.startsWith('http')) {
      const { data } = await supabase.storage.from('agent-faces').createSignedUrl(agent.custom_face_image_url, 3600);
      if (data?.signedUrl) agent.custom_face_image_url = data.signedUrl;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Agents</h1>
          <p className="mt-1 text-sm text-text-muted">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-hover bg-bg-surface p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-muted">
            <Bot className="h-8 w-8 text-accent" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-text-primary">No agents yet</h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-text-secondary">
            Create your first AI voice agent to start answering questions from your website visitors.
          </p>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Create Agent
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
