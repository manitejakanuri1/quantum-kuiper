import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PLAN_LIMITS } from '@/lib/types';
import type { Plan } from '@/lib/types';
import { SettingsClient } from '@/components/settings/SettingsClient';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch agent count
  const { count: agentCount } = await supabase
    .from('agents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Fetch usage stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: usageData } = await supabase
    .from('usage_daily')
    .select('queries_count, conversations_count, tts_characters, estimated_cost_cents')
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

  const totalQueries = usageData?.reduce((sum, d) => sum + (d.queries_count || 0), 0) || 0;
  const totalConversations = usageData?.reduce((sum, d) => sum + (d.conversations_count || 0), 0) || 0;
  const totalTtsChars = usageData?.reduce((sum, d) => sum + (d.tts_characters || 0), 0) || 0;
  const totalCostCents = usageData?.reduce((sum, d) => sum + (d.estimated_cost_cents || 0), 0) || 0;

  const plan = (profile?.plan as Plan) || 'starter';
  const limits = PLAN_LIMITS[plan];

  return (
    <SettingsClient
      user={{
        id: user.id,
        email: user.email || '',
        fullName: profile?.full_name || '',
        avatarUrl: profile?.avatar_url || null,
        createdAt: user.created_at || '',
      }}
      plan={{
        name: plan,
        label: plan.charAt(0).toUpperCase() + plan.slice(1),
        queriesPerDay: limits.queriesPerDay,
        maxWebsites: limits.maxWebsites,
        queriesToday: profile?.queries_today || 0,
      }}
      usage={{
        totalQueries,
        totalConversations,
        totalTtsChars,
        totalCostCents,
        agentCount: agentCount || 0,
      }}
    />
  );
}
