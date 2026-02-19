// Test: Crawl linear.app, embed, then query with 3 questions
// Run: npx tsx tests/test-query.ts

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const NAMESPACE = 'test-linear-queries';

async function main() {
  const { crawlWebsite } = await import('../src/lib/firecrawl');
  const { chunkMarkdown } = await import('../src/lib/rag/chunker');
  const { embedTexts, embedQuery } = await import('../src/lib/voyage/embed');
  const { upsertVectors, queryVectors, deleteNamespace } = await import('../src/lib/pinecone/index');

  // ─── Step 1: Crawl linear.app (10 pages for richer content) ───
  console.log('Crawling linear.app (10 pages)...');
  const crawlResult = await crawlWebsite('https://linear.app', 10);
  if (!crawlResult.success || crawlResult.pages.length === 0) {
    console.error('Crawl failed:', crawlResult.error);
    return;
  }
  console.log(`Crawled ${crawlResult.pages.length} pages\n`);

  // ─── Step 2: Chunk all pages ───
  console.log('Chunking...');
  const allChunks: { text: string; metadata: { sourceUrl: string; pageTitle: string; chunkIndex: number } }[] = [];
  for (const page of crawlResult.pages) {
    const chunks = chunkMarkdown(page.content, page.url, page.title);
    allChunks.push(...chunks);
  }
  console.log(`Total chunks: ${allChunks.length}\n`);

  // ─── Step 3: Embed all chunks ───
  console.log('Embedding all chunks...');
  const BATCH = 128;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH).map(c => c.text);
    const embeddings = await embedTexts(batch, 'document');
    allEmbeddings.push(...embeddings);
    console.log(`  Embedded ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length}`);
  }

  // ─── Step 4: Clean + Upsert to Pinecone ───
  try { await deleteNamespace(NAMESPACE); } catch { /* ok */ }

  const vectors = allChunks.map((chunk, i) => ({
    id: `linear-${i}`,
    values: allEmbeddings[i],
    metadata: {
      sourceUrl: chunk.metadata.sourceUrl,
      pageTitle: chunk.metadata.pageTitle,
      chunkIndex: chunk.metadata.chunkIndex,
      text: chunk.text,
      agentId: 'test-linear',
      sectionHeader: (chunk.metadata as any).sectionHeader || '',
      chunkType: (chunk.metadata as any).chunkType || 'text',
    },
  }));

  console.log(`\nUpserting ${vectors.length} vectors...`);
  await upsertVectors(NAMESPACE, vectors);
  console.log('Upserted! Waiting 5s for indexing...\n');
  await new Promise(r => setTimeout(r, 5000));

  // ─── Step 5: Query with 3 questions ───
  const questions = [
    'How to use Linear: Small teams',
    'How to use Linear: Startups & mid-size companies',
    'How to use Linear: Large & scaling companies',
  ];

  for (const question of questions) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`QUERY: "${question}"`);
    console.log('═'.repeat(60));

    const queryEmbed = await embedQuery(question);
    const results = await queryVectors(NAMESPACE, queryEmbed, 5);

    if (results.length === 0) {
      console.log('  No results found.');
      continue;
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      // Clean up the text preview
      const preview = r.metadata.text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
      console.log(`\n  [${i + 1}] Score: ${r.score.toFixed(4)}`);
      console.log(`      Page: ${r.metadata.pageTitle}`);
      console.log(`      URL:  ${r.metadata.sourceUrl}`);
      console.log(`      Text: ${preview}...`);
    }
  }

  // ─── Cleanup ───
  await deleteNamespace(NAMESPACE);
  console.log('\n\nCleaned up test namespace.');
  console.log('Done!');
}

main().catch(console.error);
