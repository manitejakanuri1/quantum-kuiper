import { createAdminClient } from '@/lib/supabase/admin';

async function getConversations() {
  const supabase = createAdminClient();
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, agent_id, visitor_id, visitor_page_url, started_at, ended_at, duration_seconds, message_count, resolved, csat_rating, escalated, tts_characters, total_cost_cents')
    .order('started_at', { ascending: false })
    .limit(100);

  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, user_id');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');

  const agentMap: Record<string, { name: string; userId: string }> = {};
  agents?.forEach((a: { id: string; name: string; user_id: string }) => {
    agentMap[a.id] = { name: a.name, userId: a.user_id };
  });

  const userMap: Record<string, string> = {};
  profiles?.forEach((p: { id: string; email: string }) => {
    userMap[p.id] = p.email;
  });

  // Stats
  const totalCost = conversations?.reduce((sum, c) => sum + (c.total_cost_cents || 0), 0) || 0;
  const avgMessages = conversations?.length
    ? Math.round(conversations.reduce((sum, c) => sum + (c.message_count || 0), 0) / conversations.length)
    : 0;
  const resolvedCount = conversations?.filter(c => c.resolved).length || 0;

  return { conversations: conversations || [], agentMap, userMap, totalCost, avgMessages, resolvedCount };
}

export default async function AdminConversationsPage() {
  const { conversations, agentMap, userMap, totalCost, avgMessages, resolvedCount } = await getConversations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Conversations</h1>
        <p className="text-sm text-text-secondary">Last 100 conversations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border-default bg-bg-surface p-4">
          <p className="text-xs text-text-muted">Total</p>
          <p className="text-2xl font-bold text-text-primary">{conversations.length}</p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-surface p-4">
          <p className="text-xs text-text-muted">Avg Messages</p>
          <p className="text-2xl font-bold text-text-primary">{avgMessages}</p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-surface p-4">
          <p className="text-xs text-text-muted">Resolved</p>
          <p className="text-2xl font-bold text-green-400">{resolvedCount}</p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-surface p-4">
          <p className="text-xs text-text-muted">Total Cost</p>
          <p className="text-2xl font-bold text-text-primary">${(totalCost / 100).toFixed(2)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default bg-bg-elevated/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Agent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Messages</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Cost</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {conversations.map((convo) => {
              const agent = agentMap[convo.agent_id];
              const ownerEmail = agent ? userMap[agent.userId] : '—';
              return (
                <tr key={convo.id} className="transition-colors hover:bg-bg-elevated/30">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">{agent?.name || 'Unknown'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-muted">{ownerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-primary">{convo.message_count}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-muted">
                      {convo.duration_seconds ? `${Math.round(convo.duration_seconds / 60)}m` : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {convo.csat_rating !== null ? (
                      <span className={convo.csat_rating >= 4 ? 'text-green-400' : convo.csat_rating >= 3 ? 'text-yellow-400' : 'text-red-400'}>
                        {'★'.repeat(convo.csat_rating)}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-muted">${((convo.total_cost_cents || 0) / 100).toFixed(3)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-muted">
                      {new Date(convo.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {conversations.length === 0 && (
          <div className="p-8 text-center text-sm text-text-muted">No conversations yet</div>
        )}
      </div>
    </div>
  );
}
