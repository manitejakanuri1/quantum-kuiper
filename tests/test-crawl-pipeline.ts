// Quick test: Crawl pipeline components
// Run: npx tsx --tsconfig tsconfig.json tests/test-crawl-pipeline.ts

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  console.log('Loaded .env.local');
}

async function testPipeline() {
  console.log('=== Testing Crawl Pipeline Components ===\n');

  // 1. Test Firecrawl
  console.log('[1/4] Testing Firecrawl...');
  const { crawlWebsite } = await import('../src/lib/firecrawl');

  const crawlResult = await crawlWebsite('https://linear.app', 5); // Only 5 pages to save credits
  console.log(`  Status: ${crawlResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`  Pages: ${crawlResult.pages.length}`);
  if (crawlResult.error) console.log(`  Error: ${crawlResult.error}`);

  if (!crawlResult.success || crawlResult.pages.length === 0) {
    console.log('\n  Firecrawl failed — stopping here.');
    return;
  }

  for (const page of crawlResult.pages) {
    console.log(`  - ${page.title} (${page.url}) [${page.content.length} chars]`);
  }

  // 2. Test Chunker
  console.log('\n[2/4] Testing Chunker...');
  const { chunkMarkdown } = await import('../src/lib/rag/chunker');

  const firstPage = crawlResult.pages[0];
  const chunks = chunkMarkdown(firstPage.content, firstPage.url, firstPage.title);
  console.log(`  Chunks from first page: ${chunks.length}`);
  if (chunks.length > 0) {
    console.log(`  First chunk: ${chunks[0].text.slice(0, 100)}...`);
    console.log(`  Chunk sizes: ${chunks.map(c => c.text.length).join(', ')}`);
  }

  // 3. Test Voyage AI Embeddings
  console.log('\n[3/4] Testing Voyage AI Embeddings...');
  const { embedTexts } = await import('../src/lib/voyage/embed');

  const sampleTexts = chunks.slice(0, 3).map(c => c.text);
  const embeddings = await embedTexts(sampleTexts, 'document');
  console.log(`  Embedded ${embeddings.length} texts`);
  console.log(`  Dimensions: ${embeddings[0]?.length}`);
  console.log(`  First vector (first 5 dims): [${embeddings[0]?.slice(0, 5).join(', ')}]`);

  // 4. Test Pinecone Upsert
  console.log('\n[4/4] Testing Pinecone Upsert...');
  const { upsertVectors, queryVectors, deleteNamespace } = await import('../src/lib/pinecone/index');

  const testNamespace = 'test-linear-app';

  // Clean up any previous test data
  try {
    await deleteNamespace(testNamespace);
    console.log(`  Cleaned old namespace: ${testNamespace}`);
  } catch {
    console.log(`  No old namespace to clean`);
  }

  const vectors = chunks.slice(0, 3).map((chunk, i) => ({
    id: `test-${i}`,
    values: embeddings[i],
    metadata: {
      sourceUrl: chunk.metadata.sourceUrl,
      pageTitle: chunk.metadata.pageTitle,
      chunkIndex: chunk.metadata.chunkIndex,
      text: chunk.text,
      agentId: 'test-agent',
      sectionHeader: chunk.metadata.sectionHeader || '',
      chunkType: chunk.metadata.chunkType || 'text',
    },
  }));

  await upsertVectors(testNamespace, vectors);
  console.log(`  Upserted ${vectors.length} vectors to namespace: ${testNamespace}`);

  // Wait a moment for Pinecone to index
  console.log('  Waiting 3s for indexing...');
  await new Promise(r => setTimeout(r, 3000));

  // 5. Test Query
  console.log('\n[Bonus] Testing Vector Query...');
  const { embedQuery } = await import('../src/lib/voyage/embed');
  const queryEmbed = await embedQuery('What is Linear?');
  const results = await queryVectors(testNamespace, queryEmbed, 3);
  console.log(`  Query results: ${results.length}`);
  for (const r of results) {
    console.log(`  - Score: ${r.score.toFixed(4)} | ${r.metadata.pageTitle} | ${r.metadata.text.slice(0, 80)}...`);
  }

  // Cleanup
  await deleteNamespace(testNamespace);
  console.log(`\n  Cleaned up test namespace.`);

  console.log('\n=== All Pipeline Components Working! ===');
}

testPipeline().catch(console.error);
