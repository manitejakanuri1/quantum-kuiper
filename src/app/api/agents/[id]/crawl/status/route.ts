// Poll Crawl Progress — checks Firecrawl status or counts processed pages
// GET /api/agents/[id]/crawl/status

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCrawlJobStatus } from '@/lib/firecrawl';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  // ─── Auth check ───
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: agent, error: agentError } = await admin
    .from('agents')
    .select('id, user_id, status, crawl_job_id, crawl_error, pages_crawled, chunks_created')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── Status: crawling — check Firecrawl progress ───
  if (agent.status === 'crawling') {
    if (!agent.crawl_job_id) {
      return NextResponse.json({
        status: 'crawling',
        completed: 0,
        total: 0,
        firecrawlStatus: 'unknown',
      });
    }

    const jobStatus = await checkCrawlJobStatus(agent.crawl_job_id);

    if (!jobStatus.success) {
      return NextResponse.json({
        status: 'error',
        error: jobStatus.error || 'Failed to check crawl status',
      });
    }

    return NextResponse.json({
      status: 'crawling',
      firecrawlStatus: jobStatus.status,
      completed: jobStatus.completed,
      total: jobStatus.total,
      pagesFound: jobStatus.pages.length,
    });
  }

  // ─── Status: processing — count knowledge_pages by status ───
  if (agent.status === 'processing') {
    const { count: totalCount } = await admin
      .from('knowledge_pages')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    const { count: embeddedCount } = await admin
      .from('knowledge_pages')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'embedded');

    return NextResponse.json({
      status: 'processing',
      processed: embeddedCount ?? 0,
      total: totalCount ?? 0,
    });
  }

  // ─── Status: ready, error, pending ───
  return NextResponse.json({
    status: agent.status,
    pagesCrawled: agent.pages_crawled,
    chunksCreated: agent.chunks_created,
    error: agent.crawl_error,
  });
}
