// Process Crawl Results — scrapes pages via Crawl4AI or processes next batch
// POST /api/agents/[id]/crawl/process

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processCrawlBatch } from '@/lib/crawler';
import { chunkMarkdown } from '@/lib/rag/chunker';
import { embedTexts } from '@/lib/voyage/embed';
import { upsertVectors } from '@/lib/pinecone/index';
import type { VectorMetadata } from '@/lib/pinecone/index';
import { generateAgentPrompt } from '@/lib/rag/prompt-generator';
import { invalidateAgentCache } from '@/lib/cache';

const BATCH_SIZE = 3; // Pages per request for Phase 2 — keeps execution under 10s

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

  const { data: agent, error: agentError } = await admin
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // Phase 1: Crawl pages via Crawl4AI (BFS from crawl_queue)
    // Each call scrapes 2 pending URLs and enqueues discovered links
    // ═══════════════════════════════════════════════════════════
    if (agent.status === 'crawling') {
      const batchResult = await processCrawlBatch(agentId);

      if (batchResult.isComplete) {
        // All pages scraped — check if we got any pages
        const { count: pagesCount } = await admin
          .from('knowledge_pages')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agentId);

        if (!pagesCount || pagesCount === 0) {
          await admin.from('agents').update({
            status: 'error',
            crawl_error: 'No pages found on website',
            updated_at: new Date().toISOString(),
          }).eq('id', agentId);
          return NextResponse.json({ error: 'No pages found' }, { status: 422 });
        }

        console.log(`[Process] Crawl complete: ${pagesCount} pages found`);

        // Transition to processing phase
        await admin.from('agents').update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        }).eq('id', agentId);

        return NextResponse.json({
          status: 'processing',
          processed: 0,
          total: pagesCount,
        });
      }

      // Still crawling — return progress
      return NextResponse.json({
        status: 'crawling',
        pagesScraped: batchResult.pagesScraped,
        completed: batchResult.totalDone,
        total: batchResult.totalDone + batchResult.totalPending,
        pending: batchResult.totalPending,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // Phase 2: Process next batch of pending pages
    // Chunk → Embed → Upsert to Pinecone
    // (UNCHANGED from original — provider-agnostic)
    // ═══════════════════════════════════════════════════════════
    if (agent.status === 'processing') {
      const namespace = agent.pinecone_namespace!;

      // Find next batch of unprocessed pages
      const { data: pendingPages } = await admin
        .from('knowledge_pages')
        .select('id, source_url, page_title, markdown_content')
        .eq('agent_id', agentId)
        .eq('status', 'pending')
        .limit(BATCH_SIZE);

      if (!pendingPages || pendingPages.length === 0) {
        // All pages processed — finalize
        const { count: totalProcessed } = await admin
          .from('knowledge_pages')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .eq('status', 'embedded');

        // Count total chunks across all pages
        const { data: chunkData } = await admin
          .from('knowledge_pages')
          .select('chunk_count')
          .eq('agent_id', agentId)
          .eq('status', 'embedded');

        const totalChunks = chunkData?.reduce((sum, p) => sum + (p.chunk_count || 0), 0) ?? 0;

        await admin.from('agents').update({
          status: 'ready',
          pages_crawled: totalProcessed ?? 0,
          chunks_created: totalChunks,
          last_crawled_at: new Date().toISOString(),
          crawl_error: null,
          updated_at: new Date().toISOString(),
        }).eq('id', agentId);

        console.log(`[Process] Complete: ${totalProcessed} pages, ${totalChunks} chunks`);

        // Auto-generate system prompt (fire-and-forget, non-fatal)
        generateAgentPrompt(agentId).catch((err) => {
          console.error('[Process] Prompt generation failed (non-fatal):', err);
        });

        // Clean up crawl_queue after successful completion
        await admin.from('crawl_queue').delete().eq('agent_id', agentId);

        return NextResponse.json({
          status: 'ready',
          processed: totalProcessed ?? 0,
          total: totalProcessed ?? 0,
          chunksCreated: totalChunks,
        });
      }

      // Process this batch
      let batchProcessed = 0;

      for (const page of pendingPages) {
        try {
          const chunks = chunkMarkdown(
            page.markdown_content,
            page.source_url,
            page.page_title
          );

          if (chunks.length === 0) {
            await admin.from('knowledge_pages')
              .update({ status: 'embedded', chunk_count: 0 })
              .eq('id', page.id);
            batchProcessed++;
            continue;
          }

          // Update status to chunked
          await admin.from('knowledge_pages')
            .update({ status: 'chunked', chunk_count: chunks.length })
            .eq('id', page.id);

          // Embed all chunks
          const chunkTexts = chunks.map((c) => c.text);
          const embeddings = await embedTexts(chunkTexts, 'document');

          // Prepare vectors
          const vectors = chunks.map((chunk, i) => ({
            id: `${page.id}-${i}`,
            values: embeddings[i],
            metadata: {
              sourceUrl: chunk.metadata.sourceUrl,
              pageTitle: chunk.metadata.pageTitle,
              chunkIndex: chunk.metadata.chunkIndex,
              text: chunk.text,
              agentId,
              sectionHeader: chunk.metadata.sectionHeader || '',
              chunkType: chunk.metadata.chunkType || 'text',
            } satisfies VectorMetadata,
          }));

          // Upsert to Pinecone
          await upsertVectors(namespace, vectors);

          // Mark as embedded
          await admin.from('knowledge_pages')
            .update({ status: 'embedded', chunk_count: chunks.length })
            .eq('id', page.id);

          batchProcessed++;
          console.log(`[Process] Page done: ${page.source_url} (${chunks.length} chunks)`);
        } catch (pageError) {
          console.error(`[Process] Error on ${page.source_url}:`, pageError);
          await admin.from('knowledge_pages')
            .update({
              status: 'error',
              error_message: pageError instanceof Error ? pageError.message : 'Unknown error',
            })
            .eq('id', page.id);
          batchProcessed++;
        }
      }

      // Get current progress
      const { count: totalCount } = await admin
        .from('knowledge_pages')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId);

      const { count: embeddedCount } = await admin
        .from('knowledge_pages')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .in('status', ['embedded', 'error']);

      return NextResponse.json({
        status: 'processing',
        processed: embeddedCount ?? 0,
        total: totalCount ?? 0,
        batchProcessed,
      });
    }

    // Agent is in a state that doesn't need processing
    return NextResponse.json({
      status: agent.status,
      message: agent.status === 'ready' ? 'Already complete' : 'Nothing to process',
    });

  } catch (error) {
    console.error('[Process] Fatal error:', error);
    await admin.from('agents').update({
      status: 'error',
      crawl_error: error instanceof Error ? error.message : 'Processing failed',
      updated_at: new Date().toISOString(),
    }).eq('id', agentId);

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
