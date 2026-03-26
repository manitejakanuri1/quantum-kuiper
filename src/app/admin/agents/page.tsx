import { createAdminClient } from '@/lib/supabase/admin';

async function getAgents() {
  const supabase = createAdminClient();
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, website_url, status, user_id, voice_type, avatar_face_id, custom_face_status, custom_voice_status, pages_crawled, chunks_created, created_at, updated_at')
    .order('created_at', { ascending: false });

  // Get user emails
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name');

  const userMap: Record<string, { email: string; name: string | null }> = {};
  profiles?.forEach((p: { id: string; email: string; full_name: string | null }) => {
    userMap[p.id] = { email: p.email, name: p.full_name };
  });

  return { agents: agents || [], userMap };
}

export default async function AdminAgentsPage() {
  const { agents, userMap } = await getAgents();

  const statusCounts = {
    ready: agents.filter(a => a.status === 'ready').length,
    crawling: agents.filter(a => a.status === 'crawling').length,
    processing: agents.filter(a => a.status === 'processing').length,
    pending: agents.filter(a => a.status === 'pending').length,
    error: agents.filter(a => a.status === 'error').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Agents</h1>
        <p className="text-sm text-text-secondary">{agents.length} total agents</p>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className={`rounded-lg border px-4 py-2 ${
            status === 'ready' ? 'border-green-500/20 bg-green-500/10' :
            status === 'error' ? 'border-red-500/20 bg-red-500/10' :
            status === 'crawling' || status === 'processing' ? 'border-yellow-500/20 bg-yellow-500/10' :
            'border-border-default bg-bg-elevated'
          }`}>
            <p className="text-xs text-text-muted capitalize">{status}</p>
            <p className="text-xl font-bold text-text-primary">{count}</p>
          </div>
        ))}
      </div>

      {/* Agents Table */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default bg-bg-elevated/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Agent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Knowledge</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Voice</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Face</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {agents.map((agent) => {
              const owner = userMap[agent.user_id];
              return (
                <tr key={agent.id} className="transition-colors hover:bg-bg-elevated/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                      <p className="max-w-[200px] truncate text-xs text-text-muted">{agent.website_url}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-secondary">{owner?.email || 'Unknown'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      agent.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                      agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                      agent.status === 'crawling' || agent.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-primary">{agent.pages_crawled} pages</p>
                    <p className="text-xs text-text-muted">{agent.chunks_created} chunks</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${
                      agent.voice_type === 'cloned' ? 'text-purple-400' :
                      agent.voice_type === 'gallery' ? 'text-blue-400' :
                      'text-text-muted'
                    }`}>
                      {agent.voice_type}
                      {agent.custom_voice_status !== 'none' && agent.custom_voice_status && (
                        <span className="ml-1 text-text-muted">({agent.custom_voice_status})</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text-muted">
                      {agent.custom_face_status !== 'none' && agent.custom_face_status
                        ? <span className={
                            agent.custom_face_status === 'ready' ? 'text-green-400' :
                            agent.custom_face_status === 'processing' ? 'text-yellow-400' :
                            agent.custom_face_status === 'failed' ? 'text-red-400' :
                            'text-text-muted'
                          }>custom ({agent.custom_face_status})</span>
                        : 'preset'
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-muted">
                      {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {agents.length === 0 && (
          <div className="p-8 text-center text-sm text-text-muted">No agents found</div>
        )}
      </div>
    </div>
  );
}
