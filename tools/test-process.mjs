/**
 * Full pipeline test: Crawl → Save to DB → Chunk → Embed → Upsert to Pinecone
 * Run: node --env-file=.env.local tools/test-process.mjs
 *
 * Tests the ENTIRE backend pipeline against sitesbysara.com
 * Uses one of the existing SBS agents in the DB
 */

import Firecrawl from '@mendable/firecrawl-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───
const TARGET_URL = 'https://sitesbysara.com/';
const MAX_PAGES = 100;
const BATCH_SIZE = 3; // Match the process endpoint
const POLL_INTERVAL_MS = 5000;
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3.5-lite';

// ─── Env vars ───
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'talk-to-site';

// Validate env
const missing = [];
if (!FIRECRAWL_API_KEY) missing.push('FIRECRAWL_API_KEY');
if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!VOYAGE_API_KEY) missing.push('VOYAGE_API_KEY');
if (!PINECONE_API_KEY) missing.push('PINECONE_API_KEY');
if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
}

console.log('=== Full Pipeline Test ===');
console.log(`Target: ${TARGET_URL}`);
console.log(`Max pages: ${MAX_PAGES}`);
console.log(`Batch size: ${BATCH_SIZE}`);
console.log('');

// ─── Init clients ───
const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

// ─── Pick an agent ───
const AGENT_ID = 'fe00d3af-2d1b-4da9-95b7-472bcbcd305a'; // SBS agent

// Verify agent exists
const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, name, website_url, status, pinecone_namespace')
    .eq('id', AGENT_ID)
    .single();

if (agentErr || !agent) {
    console.error('Agent not found:', agentErr?.message);
    process.exit(1);
}
console.log(`Agent: ${agent.name} (${agent.id})`);
console.log(`Namespace: ${agent.pinecone_namespace}`);
console.log('');

// ═══════════════════════════════════════════════════════
// STEP 1: Crawl sitesbysara.com
// ═══════════════════════════════════════════════════════
console.log('[Step 1] Starting async crawl...');
const crawlResponse = await firecrawl.startCrawl(TARGET_URL, {
    limit: MAX_PAGES,
    scrapeOptions: { formats: ['markdown'] },
});
const jobId = crawlResponse.id;
console.log(`  Job ID: ${jobId}`);

// Save job ID to agent
await supabase.from('agents').update({
    status: 'crawling',
    crawl_job_id: jobId,
    crawl_error: null,
    updated_at: new Date().toISOString(),
}).eq('id', AGENT_ID);

// Poll until complete
let pages = [];
let attempts = 0;
while (attempts < 120) {
    attempts++;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const job = await firecrawl.getCrawlStatus(jobId);
    console.log(`  [${attempts}] ${job.status} | ${job.completed ?? 0}/${job.total ?? 0} pages`);

    if (job.status === 'completed') {
        for (const doc of (job.data || [])) {
            if (doc.markdown && doc.markdown.length > 50) {
                pages.push({
                    url: doc.metadata?.sourceURL || '',
                    title: doc.metadata?.title || 'Untitled',
                    content: doc.markdown,
                });
            }
        }
        break;
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
        console.error(`Crawl ${job.status}`);
        process.exit(1);
    }
}
console.log(`  Crawl complete: ${pages.length} valid pages`);
console.log('');

// ═══════════════════════════════════════════════════════
// STEP 2: Save pages to knowledge_pages DB
// ═══════════════════════════════════════════════════════
console.log('[Step 2] Saving pages to database...');

// Clean old data
await supabase.from('knowledge_pages').delete().eq('agent_id', AGENT_ID);

// Delete old Pinecone namespace
const namespace = agent.pinecone_namespace;
if (namespace) {
    try {
        const index = pinecone.index(PINECONE_INDEX_NAME).namespace(namespace);
        await index.deleteAll();
        console.log(`  Cleared Pinecone namespace: ${namespace}`);
    } catch (e) {
        console.log(`  Pinecone namespace clear skipped: ${e.message}`);
    }
}

// Simple hash function (matches process route)
function simpleHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash.toString(36);
}

// Insert pages
for (const page of pages) {
    const { error } = await supabase.from('knowledge_pages').upsert(
        {
            agent_id: AGENT_ID,
            source_url: page.url,
            page_title: page.title,
            markdown_content: page.content,
            content_hash: simpleHash(page.content),
            status: 'pending',
        },
        { onConflict: 'agent_id,source_url' }
    );
    if (error) console.error(`  DB error for ${page.url}: ${error.message}`);
}

await supabase.from('agents').update({
    status: 'processing',
    updated_at: new Date().toISOString(),
}).eq('id', AGENT_ID);

console.log(`  Saved ${pages.length} pages to knowledge_pages`);
console.log('');

// ═══════════════════════════════════════════════════════
// STEP 3: Chunk → Embed → Upsert (batch by batch)
// ═══════════════════════════════════════════════════════
console.log('[Step 3] Processing pages (chunk → embed → upsert)...');

// Simplified chunker — splits on paragraph boundaries
function chunkText(text, maxSize = 4000) {
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (cleaned.length <= maxSize) return [cleaned];

    const chunks = [];
    const paragraphs = cleaned.split('\n\n');
    let current = '';

    for (const para of paragraphs) {
        if ((current + '\n\n' + para).length > maxSize && current) {
            chunks.push(current.trim());
            current = para;
        } else {
            current = current ? current + '\n\n' + para : para;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

// Voyage embed function
async function embedTexts(texts) {
    if (texts.length === 0) return [];
    const allEmbeddings = [];
    const batchSize = 128;

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await fetch(VOYAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${VOYAGE_API_KEY}`,
            },
            body: JSON.stringify({
                model: VOYAGE_MODEL,
                input: batch,
                input_type: 'document',
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Voyage API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const embeddings = data.data
            .sort((a, b) => a.index - b.index)
            .map(item => item.embedding);
        allEmbeddings.push(...embeddings);
    }
    return allEmbeddings;
}

// Process in batches (like the process endpoint)
let totalProcessed = 0;
let totalChunks = 0;
let batchNum = 0;

while (true) {
    batchNum++;
    const { data: pendingPages } = await supabase
        .from('knowledge_pages')
        .select('id, source_url, page_title, markdown_content')
        .eq('agent_id', AGENT_ID)
        .eq('status', 'pending')
        .limit(BATCH_SIZE);

    if (!pendingPages || pendingPages.length === 0) {
        console.log('  All pages processed!');
        break;
    }

    console.log(`  Batch ${batchNum}: processing ${pendingPages.length} pages...`);

    for (const page of pendingPages) {
        try {
            const chunks = chunkText(page.markdown_content);

            if (chunks.length === 0) {
                await supabase.from('knowledge_pages')
                    .update({ status: 'embedded', chunk_count: 0 })
                    .eq('id', page.id);
                totalProcessed++;
                continue;
            }

            // Embed
            const embeddings = await embedTexts(chunks);

            // Prepare vectors
            const vectors = chunks.map((text, i) => ({
                id: `${page.id}-${i}`,
                values: embeddings[i],
                metadata: {
                    sourceUrl: page.source_url,
                    pageTitle: page.page_title,
                    chunkIndex: i,
                    text: text.slice(0, 8000), // Pinecone metadata limit
                    agentId: AGENT_ID,
                    sectionHeader: '',
                    chunkType: 'text',
                },
            }));

            // Upsert to Pinecone
            const index = pinecone.index(PINECONE_INDEX_NAME).namespace(namespace);
            for (let i = 0; i < vectors.length; i += 100) {
                const batch = vectors.slice(i, i + 100);
                await index.upsert(batch);
            }

            // Mark done
            await supabase.from('knowledge_pages')
                .update({ status: 'embedded', chunk_count: chunks.length })
                .eq('id', page.id);

            totalProcessed++;
            totalChunks += chunks.length;
            console.log(`    OK: ${page.source_url} (${chunks.length} chunks)`);
        } catch (err) {
            console.error(`    FAIL: ${page.source_url} — ${err.message}`);
            await supabase.from('knowledge_pages')
                .update({ status: 'error', error_message: err.message })
                .eq('id', page.id);
            totalProcessed++;
        }
    }
}

// ═══════════════════════════════════════════════════════
// STEP 4: Finalize agent
// ═══════════════════════════════════════════════════════
console.log('\n[Step 4] Finalizing agent...');

await supabase.from('agents').update({
    status: 'ready',
    pages_crawled: totalProcessed,
    chunks_created: totalChunks,
    last_crawled_at: new Date().toISOString(),
    crawl_error: null,
    updated_at: new Date().toISOString(),
}).eq('id', AGENT_ID);

console.log(`\n=== PIPELINE COMPLETE ===`);
console.log(`Agent: ${agent.name} (${AGENT_ID})`);
console.log(`Pages processed: ${totalProcessed}`);
console.log(`Total chunks: ${totalChunks}`);
console.log(`Status: READY`);
