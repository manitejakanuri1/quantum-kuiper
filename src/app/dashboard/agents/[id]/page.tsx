import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAgent, getKnowledgePages } from '@/lib/db';
import { AgentSettings } from '@/components/agent-settings/AgentSettings';

export default async function AgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { id } = await params;
  const agent = await getAgent(id);

  if (!agent) {
    notFound();
  }

  if (agent.user_id !== user.id) {
    redirect('/dashboard');
  }

  const knowledgePages = await getKnowledgePages(id);

  return <AgentSettings agent={agent} knowledgePages={knowledgePages} />;
}
