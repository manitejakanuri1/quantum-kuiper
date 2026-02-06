// Firecrawl SDK Wrapper
// One-time website crawling per agent

import Firecrawl from '@mendable/firecrawl-js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
    console.warn('⚠️ FIRECRAWL_API_KEY not configured');
}

// Initialize Firecrawl client
const firecrawl = FIRECRAWL_API_KEY ? new Firecrawl({ apiKey: FIRECRAWL_API_KEY }) : null;

export interface CrawledPage {
    url: string;
    title: string;
    content: string;
}

export interface CrawlResult {
    success: boolean;
    pages: CrawledPage[];
    totalPages: number;
    error?: string;
}

/**
 * Crawl entire website using Firecrawl
 * This should only be called ONCE per agent at creation time
 * 
 * @param websiteUrl - The main URL to crawl
 * @param maxPages - Maximum pages to crawl (default: 30)
 */
export async function crawlWebsite(websiteUrl: string, maxPages: number = 30): Promise<CrawlResult> {
    if (!firecrawl) {
        console.error('[Firecrawl] API key not configured');
        return {
            success: false,
            pages: [],
            totalPages: 0,
            error: 'Firecrawl API key not configured'
        };
    }

    try {
        console.log(`[Firecrawl] Starting crawl for: ${websiteUrl}`);
        console.log(`[Firecrawl] Max pages: ${maxPages}`);

        // Use the crawl method - it waits for completion and returns CrawlJob
        // CrawlJob has { id, status, total, completed, creditsUsed, expiresAt, data: Document[] }
        const crawlResponse = await firecrawl.crawl(websiteUrl, {
            limit: maxPages,
            scrapeOptions: {
                formats: ['markdown'],
            }
        });

        console.log('[Firecrawl] Crawl response status:', crawlResponse.status);

        // Check if crawl failed or was cancelled
        if (crawlResponse.status === 'failed' || crawlResponse.status === 'cancelled') {
            console.error('[Firecrawl] Crawl status:', crawlResponse.status);
            return {
                success: false,
                pages: [],
                totalPages: 0,
                error: `Crawl ${crawlResponse.status}`
            };
        }

        // Transform Firecrawl response to our format
        // CrawlJob.data is Document[] which has markdown, metadata, etc.
        const pages: CrawledPage[] = [];

        if (crawlResponse.data && Array.isArray(crawlResponse.data)) {
            for (const doc of crawlResponse.data) {
                if (doc.markdown && doc.markdown.length > 50) {
                    pages.push({
                        url: doc.metadata?.sourceURL || websiteUrl,
                        title: doc.metadata?.title || 'Untitled',
                        content: doc.markdown
                    });
                }
            }
        }

        console.log(`[Firecrawl] Crawl complete: ${pages.length} pages extracted`);

        return {
            success: true,
            pages,
            totalPages: pages.length
        };
    } catch (error) {
        console.error('[Firecrawl] Crawl error:', error);
        return {
            success: false,
            pages: [],
            totalPages: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Check if Firecrawl is properly configured
 */
export function isFirecrawlConfigured(): boolean {
    return !!FIRECRAWL_API_KEY;
}
