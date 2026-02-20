// Firecrawl SDK Wrapper
// Async crawling for Vercel free plan compatibility (10s function timeout)

import Firecrawl from '@mendable/firecrawl-js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY?.trim();

if (!FIRECRAWL_API_KEY) {
    console.warn('[Firecrawl] FIRECRAWL_API_KEY not configured');
}

const firecrawl = FIRECRAWL_API_KEY ? new Firecrawl({ apiKey: FIRECRAWL_API_KEY }) : null;

export interface CrawledPage {
    url: string;
    title: string;
    content: string;
}

export interface AsyncCrawlStartResult {
    success: boolean;
    jobId?: string;
    error?: string;
}

export interface CrawlStatusResult {
    success: boolean;
    status: 'scraping' | 'completed' | 'failed' | 'cancelled';
    completed: number;
    total: number;
    pages: CrawledPage[];
    error?: string;
}

/**
 * Start an async crawl — returns immediately with a job ID.
 * Firecrawl does the crawling in the background.
 * Uses v2 SDK: firecrawl.startCrawl() (not the blocking firecrawl.crawl())
 */
export async function startAsyncCrawl(websiteUrl: string, maxPages: number = 100): Promise<AsyncCrawlStartResult> {
    if (!firecrawl) {
        return { success: false, error: 'Firecrawl API key not configured' };
    }

    try {
        console.log(`[Firecrawl] Starting async crawl for: ${websiteUrl} (max ${maxPages} pages)`);

        const response = await firecrawl.startCrawl(websiteUrl, {
            limit: maxPages,
            scrapeOptions: {
                formats: ['markdown'],
            },
        });

        const jobId = response.id;
        if (!jobId) {
            return { success: false, error: 'No job ID returned from Firecrawl' };
        }

        console.log(`[Firecrawl] Async crawl started, job ID: ${jobId}`);
        return { success: true, jobId };
    } catch (error) {
        console.error('[Firecrawl] Async crawl start error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check the status of an async crawl job.
 * Returns progress info and pages when complete.
 * Uses v2 SDK: firecrawl.getCrawlStatus()
 */
export async function checkCrawlJobStatus(jobId: string): Promise<CrawlStatusResult> {
    if (!firecrawl) {
        return { success: false, status: 'failed', completed: 0, total: 0, pages: [], error: 'Firecrawl API key not configured' };
    }

    try {
        const job = await firecrawl.getCrawlStatus(jobId);

        const pages: CrawledPage[] = [];

        // Extract pages if crawl is complete
        if (job.status === 'completed' && job.data) {
            for (const doc of job.data) {
                if (doc.markdown && doc.markdown.length > 50) {
                    pages.push({
                        url: doc.metadata?.sourceURL || '',
                        title: doc.metadata?.title || 'Untitled',
                        content: doc.markdown,
                    });
                }
            }
        }

        return {
            success: true,
            status: job.status,
            completed: job.completed ?? 0,
            total: job.total ?? 0,
            pages,
        };
    } catch (error) {
        console.error('[Firecrawl] Status check error:', error);
        return {
            success: false,
            status: 'failed',
            completed: 0,
            total: 0,
            pages: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check if Firecrawl is properly configured
 */
export function isFirecrawlConfigured(): boolean {
    return !!FIRECRAWL_API_KEY;
}
