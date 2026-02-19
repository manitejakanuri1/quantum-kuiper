import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentBuilderClient from '@/components/AgentBuilderClient';

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ face?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { face } = await searchParams;

  return <AgentBuilderClient agent={null} initialFaceId={face} />;
}
