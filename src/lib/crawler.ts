// Crawl Orchestrator — BFS page-by-page crawling via Crawl4AI
// Manages crawl_queue table for link discovery and page scraping

import { createAdminClient } from '@/lib/supabase/admin';
import { scrapePage } from '@/lib/crawl4ai';
import type { CrawledPage } from '@/lib/firecrawl';

// ─── Config ───
const MAX_PAGES = 100;   // Max pages per crawl
const MAX_DEPTH = 3;     // Max link depth from root
const BATCH_SIZE = 2;    // Pages per /crawl/process call (fits 8s timeout)

export interface CrawlProgress {
  pending: number;
  scraped: number;
  errored: number;
  total: number;
}

export interface CrawlBatchResult {
  pagesScraped: number;
  totalPending: number;
  totalDone: number;
  pages: CrawledPage[];
  isComplete: boolean;
}

/**
 * Start a new crawl — seed the crawl_queue with the root URL.
 * Clears any previous queue entries for this agent.
 */
export async function startCrawl(
  agentId: string,
  websiteUrl: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  try {
    // Clear old queue for this agent
    await admin.from('crawl_queue').delete().eq('agent_id', agentId);

    // Normalize root URL (remove trailing slash)
    const normalizedUrl = websiteUrl.replace(/\/+$/, '');

    // Seed with root URL at depth 0
    const { error } = await admin.from('crawl_queue').insert({
      agent_id: agentId,
      url: normalizedUrl,
      depth: 0,
      status: 'pending',
    });

    if (error) {
      console.error('[Crawler] Failed to seed crawl_queue:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Crawler] Crawl started for agent ${agentId}, root: ${normalizedUrl}`);
    return { success: true };
  } catch (error) {
    console.error('[Crawler] startCrawl error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Process the next batch of URLs from the crawl queue.
 * Scrapes pages, saves to knowledge_pages, and enqueues discovered links.
 * Called by /crawl/process during Phase 1 (status === 'crawling').
 */
export async function processCrawlBatch(agentId: string): Promise<CrawlBatchResult> {
  const admin = createAdminClient();
  const pages: CrawledPage[] = [];

  // Count total scraped pages to enforce MAX_PAGES limit
  const { count: scrapedCount } = await admin
    .from('crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('status', 'scraped');

  const totalScraped = scrapedCount ?? 0;
  const remainingBudget = MAX_PAGES - totalScraped;

  if (remainingBudget <= 0) {
    // Hit page limit — mark remaining pending as skipped
    console.log(`[Crawler] Page limit reached (${MAX_PAGES}). Stopping discovery.`);
    return await buildResult(admin, agentId, pages, 0);
  }

  // Pick next batch of pending URLs (BFS: shallowest first)
  const batchLimit = Math.min(BATCH_SIZE, remainingBudget);
  const { data: pendingUrls, error: fetchError } = await admin
    .from('crawl_queue')
    .select('id, url, depth')
    .eq('agent_id', agentId)
    .eq('status', 'pending')
    .order('depth', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(batchLimit);

  if (fetchError) {
    console.error('[Crawler] Failed to fetch pending URLs:', fetchError);
    return { pagesScraped: 0, totalPending: 0, totalDone: totalScraped, pages: [], isComplete: true };
  }

  if (!pendingUrls || pendingUrls.length === 0) {
    // No more pending URLs — crawl is complete
    return await buildResult(admin, agentId, pages, 0);
  }

  let batchScraped = 0;
  let rateLimited = false;

  for (const item of pendingUrls) {
    const result = await scrapePage(item.url);

    if (result.success && result.markdown.length > 50) {
      // Mark as scraped
      await admin.from('crawl_queue').update({
        status: 'scraped',
        scraped_at: new Date().toISOString(),
      }).eq('id', item.id);

      // Save to knowledge_pages
      await admin.from('knowledge_pages').upsert(
        {
          agent_id: agentId,
          source_url: result.url,
          page_title: result.title,
          markdown_content: result.markdown,
          content_hash: simpleHash(result.markdown),
          status: 'pending',
        },
        { onConflict: 'agent_id,source_url' }
      );

      // Convert to CrawledPage for return
      pages.push({
        url: result.url,
        title: result.title,
        content: result.markdown,
      });

      // Enqueue discovered internal links (if within depth limit)
      if (item.depth < MAX_DEPTH && result.internalLinks.length > 0) {
        await enqueueNewLinks(admin, agentId, result.internalLinks, item.depth + 1);
      }

      batchScraped++;
    } else {
      // Check for rate limit (HTTP 429) — stop crawling immediately
      if (result.error?.includes('429') || result.error?.includes('limit exceeded')) {
        console.warn(`[Crawler] Rate limit hit: ${result.error}. Stopping crawl.`);
        rateLimited = true;

        // Mark this URL and all remaining pending URLs as rate-limited
        await admin.from('crawl_queue').update({
          status: 'error',
          error_message: 'API rate limit reached',
          scraped_at: new Date().toISOString(),
        }).eq('id', item.id);

        await admin.from('crawl_queue').update({
          status: 'error',
          error_message: 'API rate limit reached — skipped',
        }).eq('agent_id', agentId).eq('status', 'pending');

        break; // Stop processing this batch
      }

      // Mark as error (non-rate-limit)
      await admin.from('crawl_queue').update({
        status: 'error',
        error_message: result.error || 'Empty or too short content',
        scraped_at: new Date().toISOString(),
      }).eq('id', item.id);
    }
  }

  // If rate limited, force completion so we process whatever pages we have
  if (rateLimited) {
    const progress = await getCrawlProgress(agentId);
    return {
      pagesScraped: batchScraped,
      totalPending: 0, // Report 0 pending to trigger completion
      totalDone: progress.scraped,
      pages,
      isComplete: true, // Force crawl phase to complete
    };
  }

  return await buildResult(admin, agentId, pages, batchScraped);
}

/**
 * Get current crawl progress from the queue.
 */
export async function getCrawlProgress(agentId: string): Promise<CrawlProgress> {
  const admin = createAdminClient();

  const [pendingResult, scrapedResult, errorResult] = await Promise.all([
    admin.from('crawl_queue').select('*', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', 'pending'),
    admin.from('crawl_queue').select('*', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', 'scraped'),
    admin.from('crawl_queue').select('*', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', 'error'),
  ]);

  const pending = pendingResult.count ?? 0;
  const scraped = scrapedResult.count ?? 0;
  const errored = errorResult.count ?? 0;

  return {
    pending,
    scraped,
    errored,
    total: pending + scraped + errored,
  };
}

// ─── Helpers ───

/**
 * Enqueue newly discovered links, skipping duplicates.
 * Uses INSERT ... ON CONFLICT DO NOTHING via upsert with ignoreDuplicates.
 */
async function enqueueNewLinks(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  links: string[],
  depth: number
): Promise<void> {
  if (links.length === 0) return;

  // Also respect MAX_PAGES: count how many total URLs we have
  const { count } = await admin
    .from('crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  const currentTotal = count ?? 0;
  const budget = MAX_PAGES - currentTotal;

  if (budget <= 0) return;

  // Only enqueue up to the remaining budget
  const linksToAdd = links.slice(0, budget);

  const rows = linksToAdd.map((url) => ({
    agent_id: agentId,
    url: url.replace(/\/+$/, ''), // normalize trailing slash
    depth,
    status: 'pending' as const,
  }));

  // Insert with ignoreDuplicates — won't fail on UNIQUE(agent_id, url)
  const { error } = await admin
    .from('crawl_queue')
    .upsert(rows, { onConflict: 'agent_id,url', ignoreDuplicates: true });

  if (error) {
    console.error('[Crawler] Failed to enqueue links:', error);
  } else {
    console.log(`[Crawler] Enqueued ${linksToAdd.length} new links at depth ${depth}`);
  }
}

/**
 * Build the batch result with current queue counts.
 */
async function buildResult(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  pages: CrawledPage[],
  batchScraped: number
): Promise<CrawlBatchResult> {
  const progress = await getCrawlProgress(agentId);

  return {
    pagesScraped: batchScraped,
    totalPending: progress.pending,
    totalDone: progress.scraped,
    pages,
    isComplete: progress.pending === 0,
  };
}

/**
 * Simple hash for content deduplication (same as process/route.ts).
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
