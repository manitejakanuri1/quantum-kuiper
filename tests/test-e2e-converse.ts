/**
 * End-to-End Test: Create agent → Crawl → Index → Query via /converse endpoint
 *
 * Usage: npx tsx tests/test-e2e-converse.ts
 *
 * Prerequisites:
 * - .env.local with all required API keys
 * - Supabase project running with schema applied
 * - Pinecone index 'talk-to-site' created (1024 dims, cosine)
 * - Dev server running at http://localhost:3000
 */

import * as fs from 'fs';
import * as path from 'path';

// ---- Load .env.local manually (no dotenv dependency) ----
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();
  // Strip surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

// ---- Imports (after env is loaded) ----
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEV_SERVER = process.env.DEV_SERVER || 'http://localhost:3000';

// Admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Helper ----
function log(step: string, msg: string) {
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`[${step}] ${msg}`);
  console.log(`[${'='.repeat(60)}]`);
}

// ---- Step 1: Create test agent in Supabase ----
async function createTestAgent(): Promise<string> {
  log('Step 1', 'Creating test agent in Supabase...');

  // First check if a test agent already exists
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('name', 'Linear Test Agent')
    .single();

  if (existing) {
    console.log(`  Found existing agent: ${existing.id}`);
    return existing.id;
  }

  // Use the existing auth user as agent owner
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUserId = users?.users?.[0]?.id;
  if (!testUserId) {
    throw new Error('No auth users found in Supabase. Sign up first at http://localhost:3000/auth/signup');
  }
  console.log(`  Using user: ${testUserId}`);

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      user_id: testUserId,
      name: 'Linear Test Agent',
      website_url: 'https://linear.app',
      greeting_message: 'Hi! I can answer questions about Linear.',
      system_prompt: 'You are a helpful assistant for the Linear project management tool. Answer questions using only the provided context from the Linear website.',
      status: 'pending',
      pinecone_namespace: 'agent-linear-e2e-test',
      widget_color: '#F97316',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`);
  }

  console.log(`  Created agent: ${agent.id}`);
  return agent.id;
}

// ---- Step 2: Crawl linear.app using the crawl endpoint ----
async function crawlAndIndex(agentId: string): Promise<void> {
  log('Step 2', 'Crawling linear.app and indexing into Pinecone...');
  console.log('  This uses the same pipeline as production (Firecrawl → Chunk → Embed → Pinecone)');
  console.log('  Calling /api/agents/[id]/crawl endpoint...');

  // We need to check if data is already indexed
  // Try querying Pinecone first
  const { embedQuery } = await import('../src/lib/voyage/embed');
  const { queryVectors } = await import('../src/lib/pinecone/index');

  const FORCE_RECRAWL = process.env.FORCE_RECRAWL === '1';

  if (!FORCE_RECRAWL) {
    try {
      console.log('  Checking if Pinecone namespace already has data...');
      const testVector = await embedQuery('What is Linear?');
      const results = await queryVectors('agent-linear-e2e-test', testVector, 1);
      if (results.length > 0 && results[0].score > 0.3) {
        console.log(`  Pinecone namespace already has data (score: ${results[0].score.toFixed(3)}). Skipping crawl.`);
        await supabase.from('agents').update({ status: 'ready' }).eq('id', agentId);
        return;
      }
      console.log('  No relevant data found. Will crawl fresh.');
    } catch (e: any) {
      console.log(`  No existing data in Pinecone namespace (${e.message?.slice(0, 80)}). Will crawl fresh.`);
    }
  } else {
    console.log('  FORCE_RECRAWL=1 — Wiping old data and re-crawling...');
    const { deleteNamespace } = await import('../src/lib/pinecone/index');
    await deleteNamespace('agent-linear-e2e-test');
    console.log('  Deleted old vectors from Pinecone namespace.');
    // Delete old knowledge pages
    await supabase.from('knowledge_pages').delete().eq('agent_id', agentId);
    console.log('  Deleted old knowledge pages from Supabase.');
  }

  // Use the crawl pipeline directly (since we may not have auth cookies for the API endpoint)
  const { crawlWebsite } = await import('../src/lib/firecrawl');
  const { chunkMarkdown } = await import('../src/lib/rag/chunker');
  const { embedTexts } = await import('../src/lib/voyage/embed');
  const { upsertVectors } = await import('../src/lib/pinecone/index');

  // 2a. Crawl
  const MAX_PAGES = parseInt(process.env.MAX_PAGES || '100', 10);
  console.log(`\n  [2a] Crawling linear.app (max ${MAX_PAGES} pages)...`);
  const crawlResult = await crawlWebsite('https://linear.app', MAX_PAGES);

  if (!crawlResult.success || crawlResult.pages.length === 0) {
    throw new Error(`Crawl failed: ${crawlResult.error || 'No pages'}`);
  }
  console.log(`  Crawled ${crawlResult.pages.length} pages`);

  // 2b. Chunk all pages
  console.log('\n  [2b] Chunking pages...');
  let allChunks: { text: string; metadata: { sourceUrl: string; pageTitle: string; chunkIndex: number; sectionHeader: string; chunkType: string } }[] = [];

  for (const page of crawlResult.pages) {
    const chunks = chunkMarkdown(page.content, page.url, page.title);
    allChunks.push(...chunks);
    console.log(`    ${page.title}: ${chunks.length} chunks`);
  }
  console.log(`  Total chunks: ${allChunks.length}`);

  // Save pages to Supabase
  for (const page of crawlResult.pages) {
    const pageChunks = allChunks.filter(c => c.metadata.sourceUrl === page.url);
    await supabase.from('knowledge_pages').insert({
      agent_id: agentId,
      url: page.url,
      title: page.title,
      markdown_content: page.content.slice(0, 50000), // Truncate for storage
      chunk_count: pageChunks.length,
      status: 'pending',
    });
  }

  // 2c. Embed all chunks (billing active — 300 RPM, no delays needed)
  console.log('\n  [2c] Embedding chunks with Voyage AI...');
  const chunkTexts = allChunks.map(c => c.text);
  const embeddings = await embedTexts(chunkTexts, 'document');
  console.log(`  Embedded ${embeddings.length} chunks (${embeddings[0]?.length || 0} dimensions each)`);

  // 2d. Upsert to Pinecone
  console.log('\n  [2d] Upserting vectors to Pinecone...');
  const vectors = allChunks.map((chunk, i) => ({
    id: `linear-e2e-${i}`,
    values: embeddings[i],
    metadata: {
      sourceUrl: chunk.metadata.sourceUrl,
      pageTitle: chunk.metadata.pageTitle,
      chunkIndex: chunk.metadata.chunkIndex,
      text: chunk.text.slice(0, 8000), // Pinecone metadata limit
      agentId: agentId,
      sectionHeader: chunk.metadata.sectionHeader || '',
      chunkType: chunk.metadata.chunkType || 'text',
    },
  }));

  await upsertVectors('agent-linear-e2e-test', vectors);
  console.log(`  Upserted ${vectors.length} vectors to namespace 'agent-linear-e2e-test'`);

  // Wait for Pinecone to index
  console.log('\n  Waiting 10s for Pinecone indexing...');
  await new Promise(r => setTimeout(r, 10000));

  // Update agent status
  await supabase.from('agents').update({
    status: 'ready',
    pages_crawled: crawlResult.pages.length,
    chunks_created: allChunks.length,
    last_crawled_at: new Date().toISOString(),
  }).eq('id', agentId);

  // Update page statuses
  await supabase.from('knowledge_pages')
    .update({ status: 'embedded' })
    .eq('agent_id', agentId);

  console.log('\n  Agent is READY!');
}

// ---- Step 3: Test the converse endpoint ----
async function testConverse(agentId: string): Promise<void> {
  log('Step 3', 'Testing /api/agents/[id]/converse endpoint...');

  const questions = [
    'How to use Linear: Small teams',
    'How to use Linear: Startups & mid-size companies',
    'How to use Linear: Large & scaling companies',
  ];

  for (const question of questions) {
    console.log(`\n  Q: "${question}"`);
    console.log('  ---');

    try {
      const response = await fetch(`${DEV_SERVER}/api/agents/${agentId}/converse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question,
          visitorId: 'test-visitor-001',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`  ERROR ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();

      console.log(`  A: ${data.answer}`);
      console.log(`  ---`);
      console.log(`  Sources: ${data.sources?.length || 0}`);
      if (data.sources && data.sources.length > 0) {
        for (const src of data.sources.slice(0, 3)) {
          console.log(`    - [${src.score?.toFixed(3)}] ${src.title} (${src.url})`);
        }
      }
      console.log(`  Retrieval: ${data.retrievalTimeMs}ms | Generation: ${data.generationTimeMs}ms`);
      console.log(`  Tokens: ${data.tokensUsed?.input || 0} in / ${data.tokensUsed?.output || 0} out`);
      console.log(`  ConversationId: ${data.conversationId}`);
    } catch (error) {
      console.log(`  FETCH ERROR: ${error}`);
    }
  }
}

// ---- Step 3b: Test greetings + irrelevant questions ----
async function testRouterAndFallback(agentId: string): Promise<void> {
  log('Step 3b', 'Testing query router (greetings) + fallback (irrelevant questions)...');

  const greetings = [
    { q: 'Hi', expect: 'greeting — should skip RAG, $0 cost' },
    { q: 'Thanks', expect: 'farewell — should skip RAG, $0 cost' },
    { q: 'Who are you?', expect: 'chitchat — should skip RAG, $0 cost' },
  ];

  const irrelevant = [
    { q: 'How to make chicken curry', expect: 'fallback — should skip Gemini' },
    { q: 'What is the weather today', expect: 'fallback — should skip Gemini' },
    { q: 'Tell me a joke', expect: 'fallback — should skip Gemini' },
  ];

  console.log('\n  --- GREETINGS (should skip RAG entirely) ---');
  for (const { q, expect } of greetings) {
    console.log(`\n  Q: "${q}" [${expect}]`);
    try {
      const response = await fetch(`${DEV_SERVER}/api/agents/${agentId}/converse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, visitorId: 'test-visitor-002' }),
      });
      const data = await response.json();
      console.log(`  A: ${data.answer}`);
      console.log(`  Routed: ${data.routed || 'none'} | Tokens: ${data.tokensUsed?.input || 0}/${data.tokensUsed?.output || 0} | Retrieval: ${data.retrievalTimeMs}ms`);
      if (data.routed) {
        console.log(`  ✅ Correctly routed — no API costs!`);
      } else {
        console.log(`  ⚠️  NOT routed — went through full pipeline`);
      }
    } catch (error) {
      console.log(`  FETCH ERROR: ${error}`);
    }
  }

  console.log('\n  --- IRRELEVANT QUESTIONS (should skip Gemini, use fallback) ---');
  for (const { q, expect } of irrelevant) {
    console.log(`\n  Q: "${q}" [${expect}]`);
    try {
      const response = await fetch(`${DEV_SERVER}/api/agents/${agentId}/converse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, visitorId: 'test-visitor-002' }),
      });
      const data = await response.json();
      console.log(`  A: ${data.answer}`);
      console.log(`  Fallback: ${data.usedFallback ? 'YES' : 'NO'} | Tokens: ${data.tokensUsed?.input || 0}/${data.tokensUsed?.output || 0} | Retrieval: ${data.retrievalTimeMs}ms`);
      if (data.usedFallback) {
        console.log(`  ✅ Correctly used fallback — Gemini credits saved!`);
      } else if (data.tokensUsed?.input === 0) {
        console.log(`  ✅ No Gemini tokens used`);
      } else {
        console.log(`  ⚠️  Called Gemini (${data.tokensUsed?.input} tokens) — fallback didn't trigger`);
      }
    } catch (error) {
      console.log(`  FETCH ERROR: ${error}`);
    }
  }
}

// ---- Step 4: Test TTS endpoint ----
async function testTTS(): Promise<void> {
  log('Step 4', 'Testing /api/tts endpoint...');

  const testText = 'Linear helps small teams streamline their workflow and ship faster.';
  const testVoiceId = '1b160c4cf02e4855a09efd59475b9370'; // Default voice

  console.log(`  Text: "${testText}"`);
  console.log(`  Voice: ${testVoiceId}`);

  try {
    const response = await fetch(`${DEV_SERVER}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testText,
        voiceId: testVoiceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ERROR ${response.status}: ${errorText}`);
      return;
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const audioBuffer = await response.arrayBuffer();

    console.log(`  Content-Type: ${contentType}`);
    console.log(`  Content-Length: ${contentLength || audioBuffer.byteLength} bytes`);
    console.log(`  Audio received: ${audioBuffer.byteLength} bytes`);
    console.log(`  TTS endpoint working!`);
  } catch (error) {
    console.log(`  FETCH ERROR: ${error}`);
  }
}

// ---- Main ----
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Talk to Site — End-to-End RAG Conversation Test            ║');
  console.log('║  Agent: Linear Test Agent | Website: linear.app             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Create test agent
    const agentId = await createTestAgent();

    // Step 2: Crawl + Index
    await crawlAndIndex(agentId);

    // Step 3: Test converse endpoint (requires dev server running)
    console.log('\n⚠️  Steps 3 & 4 require the dev server running at http://localhost:3000');
    console.log('   Start it with: npm run dev');

    // Check if dev server is running
    try {
      await fetch(`${DEV_SERVER}/api/agents/${agentId}/converse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });
    } catch {
      console.log('\n❌ Dev server not running. Steps 1-2 completed (agent created + data indexed).');
      console.log(`   Agent ID: ${agentId}`);
      console.log('   Start the dev server and re-run this test, or run:');
      console.log(`   curl -X POST http://localhost:3000/api/agents/${agentId}/converse -H "Content-Type: application/json" -d '{"query":"How to use Linear?"}'`);
      return;
    }

    await testConverse(agentId);

    // Step 3b: Test greetings + irrelevant questions
    await testRouterAndFallback(agentId);

    // Step 4: Test TTS
    await testTTS();

    // Done
    log('DONE', 'All tests completed!');
    console.log(`\n  Agent ID: ${agentId}`);
    console.log('  You can now test the full voice pipeline in the browser.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
