// Poll Crawl Progress — checks crawl_queue or counts processed pages
// GET /api/agents/[id]/crawl/status

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCrawlProgress } from '@/lib/crawler';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

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
    .select('id, user_id, status, crawl_error, pages_crawled, chunks_created')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── Status: crawling — check crawl_queue progress ───
  if (agent.status === 'crawling') {
    const progress = await getCrawlProgress(agentId);

    return NextResponse.json({
      status: 'crawling',
      completed: progress.scraped,
      total: progress.total,
      pending: progress.pending,
      errored: progress.errored,
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
