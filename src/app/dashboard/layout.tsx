import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { MobileTabBar } from '@/components/MobileTabBar';
import { PLAN_LIMITS } from '@/lib/types';
import type { Plan } from '@/lib/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch profile for plan info and usage
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, queries_today')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan as Plan) || 'starter';
  const queriesToday = profile?.queries_today || 0;
  const queryLimit = PLAN_LIMITS[plan]?.queriesPerDay || 30;

  return (
    <div className="min-h-screen bg-bg-base">
      <DashboardSidebar
        userEmail={user.email}
        plan={plan}
        queriesToday={queriesToday}
        queryLimit={queryLimit}
      />
      <MobileTabBar />
      <main className="min-h-screen pb-16 md:ml-64 md:pb-0">
        {children}
      </main>
    </div>
  );
}
