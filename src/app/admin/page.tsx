import { createAdminClient } from '@/lib/supabase/admin';

async function getStats() {
  const supabase = createAdminClient();

  const [usersRes, agentsRes, readyAgentsRes, convosRes, plansRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('agents').select('id', { count: 'exact', head: true }),
    supabase.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('conversations').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('plan'),
  ]);

  const planCounts: Record<string, number> = {};
  plansRes.data?.forEach((p: { plan: string }) => {
    planCounts[p.plan] = (planCounts[p.plan] || 0) + 1;
  });

  return {
    totalUsers: usersRes.count || 0,
    totalAgents: agentsRes.count || 0,
    readyAgents: readyAgentsRes.count || 0,
    totalConversations: convosRes.count || 0,
    planCounts,
  };
}

async function getRecentUsers() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, plan_status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  return data || [];
}

async function getRecentAgents() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('agents')
    .select('id, name, website_url, status, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  return data || [];
}

export default async function AdminOverview() {
  const [stats, recentUsers, recentAgents] = await Promise.all([
    getStats(),
    getRecentUsers(),
    getRecentAgents(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="text-sm text-text-secondary">Overview of Talk to Site platform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} color="blue" />
        <StatCard label="Total Agents" value={stats.totalAgents} sub={`${stats.readyAgents} ready`} color="green" />
        <StatCard label="Conversations" value={stats.totalConversations} color="purple" />
        <StatCard label="Active Plans" value={Object.values(stats.planCounts).reduce((a, b) => a + b, 0)} color="orange" />
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Plan Distribution</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.planCounts).map(([plan, count]) => (
            <div key={plan} className="rounded-lg border border-border-default bg-bg-elevated px-4 py-2">
              <p className="text-xs text-text-muted capitalize">{plan}</p>
              <p className="text-xl font-bold text-text-primary">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Users + Agents side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Recent Users</h2>
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{user.full_name || user.email}</p>
                  <p className="text-xs text-text-muted">{user.email}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.plan === 'founder' ? 'bg-yellow-500/20 text-yellow-400' :
                    user.plan === 'starter' ? 'bg-blue-500/20 text-blue-400' :
                    user.plan === 'growth' ? 'bg-green-500/20 text-green-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {user.plan}
                  </span>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && (
              <p className="text-sm text-text-muted">No users yet</p>
            )}
          </div>
        </div>

        {/* Recent Agents */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Recent Agents</h2>
          <div className="space-y-3">
            {recentAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                  <p className="text-xs text-text-muted truncate max-w-[200px]">{agent.website_url}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    agent.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                    agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    agent.status === 'crawling' || agent.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {agent.status}
                  </span>
                </div>
              </div>
            ))}
            {recentAgents.length === 0 && (
              <p className="text-sm text-text-muted">No agents yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    green: 'from-green-500/10 to-green-500/5 border-green-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20',
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-text-primary">{value.toLocaleString()}</p>
      {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}
