// Crawl Pipeline — Orchestrates: crawl → chunk → embed → upsert to Pinecone
// POST /api/agents/[id]/crawl

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { crawlWebsite } from '@/lib/firecrawl';
import { chunkMarkdown } from '@/lib/rag/chunker';
import { embedTexts } from '@/lib/voyage/embed';
import { upsertVectors, deleteNamespace } from '@/lib/pinecone/index';
import type { VectorMetadata } from '@/lib/pinecone/index';
import { generateAgentPrompt } from '@/lib/rag/prompt-generator';
import { invalidateAgentCache } from '@/lib/cache';

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
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

  // Use admin client for all DB writes (bypasses RLS)
  const admin = createAdminClient();

  // Fetch agent and verify ownership
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

  // Prevent duplicate crawl — reject if already in progress
  if (agent.status === 'crawling' || agent.status === 'processing') {
    return NextResponse.json(
      { error: 'Crawl already in progress' },
      { status: 409 }
    );
  }

  try {
    // ─── Step 1: Set status to 'crawling' ───
    await admin
      .from('agents')
      .update({ status: 'crawling', crawl_error: null, updated_at: new Date().toISOString() })
      .eq('id', agentId);

    // ─── Step 2: Crawl website ───
    console.log(`[Crawl] Starting crawl for agent ${agentId}: ${agent.website_url}`);
    const crawlResult = await crawlWebsite(agent.website_url);

    if (!crawlResult.success || crawlResult.pages.length === 0) {
      await admin
        .from('agents')
        .update({
          status: 'error',
          crawl_error: crawlResult.error || 'No pages found',
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);
      return NextResponse.json(
        { error: crawlResult.error || 'Crawl failed' },
        { status: 500 }
      );
    }

    console.log(`[Crawl] Crawled ${crawlResult.pages.length} pages`);

    // ─── Step 3: Clean up old data (re-crawl) ───
    // Invalidate Redis cache for this agent (stale answers from old content)
    await invalidateAgentCache(agentId);

    if (agent.pinecone_namespace) {
      try {
        await deleteNamespace(agent.pinecone_namespace);
      } catch (e) {
        console.error('[Crawl] Failed to delete old namespace:', e);
      }
    }
    await admin.from('knowledge_pages').delete().eq('agent_id', agentId);

    // ─── Step 4: Save raw pages to knowledge_pages ───
    const pageRecords: { id: string; source_url: string; page_title: string; content: string }[] = [];

    for (const page of crawlResult.pages) {
      const { data, error } = await admin
        .from('knowledge_pages')
        .upsert(
          {
            agent_id: agentId,
            source_url: page.url,
            page_title: page.title,
            markdown_content: page.content,
            content_hash: simpleHash(page.content),
            status: 'pending',
          },
          { onConflict: 'agent_id,source_url' }
        )
        .select()
        .single();

      if (!error && data) {
        pageRecords.push({
          id: data.id,
          source_url: data.source_url,
          page_title: data.page_title || 'Untitled',
          content: page.content,
        });
      }
    }

    // ─── Step 5: Set status to 'processing' ───
    await admin
      .from('agents')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', agentId);

    // ─── Step 6: Chunk → Embed → Upsert per page ───
    const namespace = agent.pinecone_namespace!;
    let totalChunks = 0;
    let pagesProcessed = 0;

    for (const pageRecord of pageRecords) {
      try {
        // Chunk the markdown
        const chunks = chunkMarkdown(
          pageRecord.content,
          pageRecord.source_url,
          pageRecord.page_title
        );

        if (chunks.length === 0) {
          await admin
            .from('knowledge_pages')
            .update({ status: 'embedded', chunk_count: 0 })
            .eq('id', pageRecord.id);
          pagesProcessed++;
          continue;
        }

        // Update page status to 'chunked'
        await admin
          .from('knowledge_pages')
          .update({ status: 'chunked', chunk_count: chunks.length })
          .eq('id', pageRecord.id);

        // Embed all chunks for this page
        const chunkTexts = chunks.map((c) => c.text);
        const embeddings = await embedTexts(chunkTexts, 'document');

        // Prepare vectors with metadata
        const vectors = chunks.map((chunk, i) => ({
          id: `${pageRecord.id}-${i}`,
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

        // Update page status to 'embedded'
        await admin
          .from('knowledge_pages')
          .update({ status: 'embedded', chunk_count: chunks.length })
          .eq('id', pageRecord.id);

        totalChunks += chunks.length;
        pagesProcessed++;

        console.log(
          `[Crawl] Processed page ${pagesProcessed}/${pageRecords.length}: ${pageRecord.source_url} (${chunks.length} chunks)`
        );
      } catch (pageError) {
        // Per-page error: mark page as error, continue with others
        console.error(`[Crawl] Error processing ${pageRecord.source_url}:`, pageError);
        await admin
          .from('knowledge_pages')
          .update({
            status: 'error',
            error_message: pageError instanceof Error ? pageError.message : 'Unknown error',
          })
          .eq('id', pageRecord.id);
        pagesProcessed++;
      }
    }

    // ─── Step 7: Set agent to 'ready' ───
    await admin
      .from('agents')
      .update({
        status: 'ready',
        pages_crawled: pagesProcessed,
        chunks_created: totalChunks,
        last_crawled_at: new Date().toISOString(),
        crawl_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    console.log(`[Crawl] Complete: ${pagesProcessed} pages, ${totalChunks} chunks`);

    // ─── Step 8: Auto-generate system prompt from crawled content ───
    try {
      console.log('[Crawl] Generating system prompt from crawled content...');
      const promptResult = await generateAgentPrompt(agentId);
      if (promptResult) {
        console.log(`[Crawl] System prompt generated (${promptResult.extractedInfo.company_name}, tone: ${promptResult.extractedInfo.tone})`);
      } else {
        console.warn('[Crawl] Prompt generation returned null — using existing prompt');
      }
    } catch (promptError) {
      // Non-fatal — agent is still ready, just with a generic prompt
      console.error('[Crawl] Prompt generation failed (non-fatal):', promptError);
    }

    return NextResponse.json({
      success: true,
      pages_crawled: pagesProcessed,
      chunks_created: totalChunks,
    });
  } catch (error) {
    // Fatal error — mark agent as error
    console.error('[Crawl] Fatal error:', error);
    await admin
      .from('agents')
      .update({
        status: 'error',
        crawl_error: error instanceof Error ? error.message : 'Unknown fatal error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    return NextResponse.json(
      { error: 'Crawl pipeline failed' },
      { status: 500 }
    );
  }
}
