import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAgent, getKnowledgePages } from '@/lib/db';
import { AgentSettings } from '@/components/agent-settings/AgentSettings';

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

/**
 * Server-side check: if face is still "processing", ask Simli if it's done.
 * Runs every time the user opens agent settings — even days later.
 * This way processing continues even after the user closes the browser.
 */
async function syncFaceStatus(agent: { id: string; custom_face_id?: string | null; custom_face_status?: string }) {
  if (agent.custom_face_status !== 'processing' || !agent.custom_face_id || !SIMLI_API_KEY) return;

  try {
    const res = await fetch(
      `https://api.simli.ai/faces/trinity/generation_status?face_id=${agent.custom_face_id}`,
      { headers: { 'X-API-Key': SIMLI_API_KEY }, next: { revalidate: 0 } }
    );

    if (!res.ok) return;

    const data = await res.json();
    const status = (data.status || data.state || '').toLowerCase();

    const admin = createAdminClient();

    if (['completed', 'ready', 'done', 'success'].includes(status)) {
      await admin.from('agents').update({ custom_face_status: 'ready' }).eq('id', agent.id);
      agent.custom_face_status = 'ready';
    } else if (['failed', 'error'].includes(status)) {
      await admin.from('agents').update({ custom_face_status: 'failed' }).eq('id', agent.id);
      agent.custom_face_status = 'failed';
    }
  } catch {
    // Simli unreachable — leave status as-is, will retry next page load
  }
}

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

  // Check Simli face status server-side (works even after browser was closed)
  await syncFaceStatus(agent);

  const knowledgePages = await getKnowledgePages(id);

  return <AgentSettings agent={agent} knowledgePages={knowledgePages} />;
}
