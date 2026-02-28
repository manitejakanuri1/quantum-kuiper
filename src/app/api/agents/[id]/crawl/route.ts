// Start Crawl — seeds crawl_queue and returns immediately
// POST /api/agents/[id]/crawl

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { startCrawl } from '@/lib/crawler';
import { invalidateAgentCache } from '@/lib/cache';
import { deleteNamespace } from '@/lib/pinecone/index';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(
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

  // Fetch agent and verify ownership
  const { data: agent, error: agentError } = await admin
    .from('agents')
    .select('id, user_id, website_url, status, pinecone_namespace')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent duplicate crawl
  if (agent.status === 'crawling' || agent.status === 'processing') {
    return NextResponse.json(
      { error: 'Crawl already in progress' },
      { status: 409 }
    );
  }

  try {
    // Clean old data before starting fresh crawl
    await invalidateAgentCache(agentId);
    if (agent.pinecone_namespace) {
      try {
        await deleteNamespace(agent.pinecone_namespace);
      } catch (e) {
        console.error('[Crawl] Failed to delete old namespace:', e);
      }
    }
    await admin.from('knowledge_pages').delete().eq('agent_id', agentId);

    // Start crawl — seeds crawl_queue with root URL
    const result = await startCrawl(agentId, agent.website_url);

    if (!result.success) {
      await admin
        .from('agents')
        .update({
          status: 'error',
          crawl_error: result.error || 'Failed to start crawl',
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      return NextResponse.json(
        { error: result.error || 'Failed to start crawl' },
        { status: 422 }
      );
    }

    // Set status to crawling
    await admin
      .from('agents')
      .update({
        status: 'crawling',
        crawl_job_id: null, // No longer using Firecrawl job IDs
        crawl_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    console.log(`[Crawl] Crawl started for agent ${agentId}, site: ${agent.website_url}`);

    return NextResponse.json(
      { status: 'crawling' },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Crawl] Fatal error:', error);
    await admin
      .from('agents')
      .update({
        status: 'error',
        crawl_error: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    return NextResponse.json({ error: 'Failed to start crawl' }, { status: 500 });
  }
}
