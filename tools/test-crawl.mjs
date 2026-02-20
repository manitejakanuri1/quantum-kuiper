/**
 * Backend test: Crawl sitesbysara.com via Firecrawl API
 * Run: node --env-file=.env.local tools/test-crawl.mjs
 *
 * Tests: API key validity, startCrawl(), getCrawlStatus(), page content
 */

import Firecrawl from '@mendable/firecrawl-js';

const API_KEY = process.env.FIRECRAWL_API_KEY?.trim();
const TARGET_URL = 'https://sitesbysara.com/';
const MAX_PAGES = 100;
const POLL_INTERVAL_MS = 5000;

if (!API_KEY) {
    console.error('ERROR: FIRECRAWL_API_KEY not found in .env.local');
    process.exit(1);
}

console.log(`API Key: ${API_KEY.slice(0, 6)}...${API_KEY.slice(-4)}`);
console.log(`Target: ${TARGET_URL}`);
console.log(`Max pages: ${MAX_PAGES}`);
console.log('---');

const firecrawl = new Firecrawl({ apiKey: API_KEY });

// Step 1: Start async crawl
console.log('[Step 1] Starting async crawl...');
let jobId;
try {
    const response = await firecrawl.startCrawl(TARGET_URL, {
        limit: MAX_PAGES,
        scrapeOptions: { formats: ['markdown'] },
    });
    jobId = response.id;
    console.log(`  Crawl started! Job ID: ${jobId}`);
} catch (error) {
    console.error('  FAILED to start crawl:', error.message || error);
    process.exit(1);
}

if (!jobId) {
    console.error('  ERROR: No job ID returned');
    process.exit(1);
}

// Step 2: Poll until complete
console.log('[Step 2] Polling for results...');
let attempts = 0;
const MAX_ATTEMPTS = 120; // 10 minutes max

while (attempts < MAX_ATTEMPTS) {
    attempts++;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    try {
        const job = await firecrawl.getCrawlStatus(jobId);
        const status = job.status;
        const completed = job.completed ?? 0;
        const total = job.total ?? 0;

        console.log(`  [${attempts}] Status: ${status} | Pages: ${completed}/${total}`);

        if (status === 'completed') {
            console.log('\n=== CRAWL COMPLETE ===');
            const pages = job.data || [];
            console.log(`Total documents returned: ${pages.length}`);

            let validPages = 0;
            for (const doc of pages) {
                const url = doc.metadata?.sourceURL || 'unknown';
                const title = doc.metadata?.title || 'Untitled';
                const contentLen = doc.markdown?.length || 0;
                const hasContent = contentLen > 50;

                if (hasContent) validPages++;
                console.log(`  ${hasContent ? 'OK' : 'SKIP'} | ${url} | "${title}" | ${contentLen} chars`);
            }

            console.log(`\n--- SUMMARY ---`);
            console.log(`Job ID: ${jobId}`);
            console.log(`Total docs: ${pages.length}`);
            console.log(`Valid pages (>50 chars): ${validPages}`);
            console.log(`Status: SUCCESS`);
            process.exit(0);
        }

        if (status === 'failed' || status === 'cancelled') {
            console.error(`\nCrawl ${status}!`);
            console.error('Full response:', JSON.stringify(job, null, 2));
            process.exit(1);
        }

    } catch (error) {
        console.error(`  [${attempts}] Poll error:`, error.message || error);
    }
}

console.error(`Timed out after ${MAX_ATTEMPTS} attempts`);
process.exit(1);
