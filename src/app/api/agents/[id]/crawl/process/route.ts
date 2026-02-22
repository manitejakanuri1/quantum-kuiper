// Process Crawl Results — saves pages or processes next batch
// POST /api/agents/[id]/crawl/process

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCrawlJobStatus } from '@/lib/firecrawl';
import { chunkMarkdown } from '@/lib/rag/chunker';
import { embedTexts } from '@/lib/voyage/embed';
import { upsertVectors, deleteNamespace } from '@/lib/pinecone/index';
import type { VectorMetadata } from '@/lib/pinecone/index';
import { generateAgentPrompt } from '@/lib/rag/prompt-generator';
import { invalidateAgentCache } from '@/lib/cache';

const BATCH_SIZE = 3; // Pages per request — keeps execution under 10s

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

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
    // Phase 1: Crawl complete → save pages to DB
    // Called when Firecrawl is done but pages aren't saved yet
    // ═══════════════════════════════════════════════════════════
    if (agent.status === 'crawling') {
      if (!agent.crawl_job_id) {
        return NextResponse.json({ error: 'No crawl job found' }, { status: 400 });
      }

      // Check if Firecrawl crawl is actually complete
      const jobStatus = await checkCrawlJobStatus(agent.crawl_job_id);

      if (!jobStatus.success) {
        await admin.from('agents').update({
          status: 'error',
          crawl_error: jobStatus.error || 'Crawl check failed',
          updated_at: new Date().toISOString(),
        }).eq('id', agentId);
        return NextResponse.json({ error: jobStatus.error }, { status: 422 });
      }

      if (jobStatus.status === 'failed' || jobStatus.status === 'cancelled') {
        await admin.from('agents').update({
          status: 'error',
          crawl_error: `Crawl ${jobStatus.status}`,
          updated_at: new Date().toISOString(),
        }).eq('id', agentId);
        return NextResponse.json({ error: `Crawl ${jobStatus.status}` }, { status: 422 });
      }

      if (jobStatus.status !== 'completed') {
        // Still crawling — tell frontend to keep polling status
        return NextResponse.json({
          status: 'crawling',
          firecrawlStatus: jobStatus.status,
          completed: jobStatus.completed,
          total: jobStatus.total,
        });
      }

      // Crawl complete — save pages
      if (jobStatus.pages.length === 0) {
        await admin.from('agents').update({
          status: 'error',
          crawl_error: 'No pages found on website',
          updated_at: new Date().toISOString(),
        }).eq('id', agentId);
        return NextResponse.json({ error: 'No pages found' }, { status: 422 });
      }

      console.log(`[Process] Crawl complete: ${jobStatus.pages.length} pages found`);

      // Clean old data
      await invalidateAgentCache(agentId);
      if (agent.pinecone_namespace) {
        try {
          await deleteNamespace(agent.pinecone_namespace);
        } catch (e) {
          console.error('[Process] Failed to delete old namespace:', e);
        }
      }
      await admin.from('knowledge_pages').delete().eq('agent_id', agentId);

      // Save all pages to knowledge_pages
      for (const page of jobStatus.pages) {
        await admin.from('knowledge_pages').upsert(
          {
            agent_id: agentId,
            source_url: page.url,
            page_title: page.title,
            markdown_content: page.content,
            content_hash: simpleHash(page.content),
            status: 'pending',
          },
          { onConflict: 'agent_id,source_url' }
        );
      }

      // Transition to processing
      await admin.from('agents').update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      }).eq('id', agentId);

      return NextResponse.json({
        status: 'processing',
        processed: 0,
        total: jobStatus.pages.length,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // Phase 2: Process next batch of pending pages
    // Chunk → Embed → Upsert to Pinecone
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
