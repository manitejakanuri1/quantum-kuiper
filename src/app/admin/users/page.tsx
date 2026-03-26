import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

async function getUsers() {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Get agent counts per user
  const { data: agents } = await supabase
    .from('agents')
    .select('user_id, status');

  const agentCounts: Record<string, { total: number; ready: number }> = {};
  agents?.forEach((a: { user_id: string; status: string }) => {
    if (!agentCounts[a.user_id]) agentCounts[a.user_id] = { total: 0, ready: 0 };
    agentCounts[a.user_id].total++;
    if (a.status === 'ready') agentCounts[a.user_id].ready++;
  });

  return { users: users || [], agentCounts };
}

export default async function AdminUsersPage() {
  const { users, agentCounts } = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary">{users.length} total users</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default bg-bg-elevated/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Agents</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Queries Today</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {users.map((user) => {
              const counts = agentCounts[user.id] || { total: 0, ready: 0 };
              return (
                <tr key={user.id} className="transition-colors hover:bg-bg-elevated/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{user.full_name || '—'}</p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.plan === 'founder' ? 'bg-yellow-500/20 text-yellow-400' :
                      user.plan === 'starter' ? 'bg-blue-500/20 text-blue-400' :
                      user.plan === 'growth' ? 'bg-green-500/20 text-green-400' :
                      user.plan === 'professional' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.plan_status === 'active' ? 'bg-green-500/20 text-green-400' :
                      user.plan_status === 'trialing' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {user.plan_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-primary">{counts.total}</p>
                    <p className="text-xs text-text-muted">{counts.ready} ready</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-primary">{user.queries_today || 0}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-muted">
                      {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-8 text-center text-sm text-text-muted">No users found</div>
        )}
      </div>
    </div>
  );
}
