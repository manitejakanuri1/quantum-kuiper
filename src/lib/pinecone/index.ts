// Pinecone Vector Store — Thin wrapper around @pinecone-database/pinecone SDK v4

import { Pinecone, type RecordMetadata } from '@pinecone-database/pinecone';

export interface VectorMetadata extends RecordMetadata {
  sourceUrl: string;
  pageTitle: string;
  chunkIndex: number;
  text: string;
  agentId: string;
  sectionHeader: string;
  chunkType: string; // 'text' | 'faq' | 'table'
}

const PINECONE_BATCH_SIZE = 100;

let _client: Pinecone | null = null;

function getClient(): Pinecone {
  if (!_client) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error('PINECONE_API_KEY not configured');
    _client = new Pinecone({ apiKey });
  }
  return _client;
}

/**
 * Get the Pinecone index reference.
 */
export function getPineconeIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME || 'talk-to-site';
  return getClient().index<VectorMetadata>(indexName);
}

/**
 * Upsert vectors into a Pinecone namespace.
 * Automatically batches in groups of 100.
 */
export async function upsertVectors(
  namespace: string,
  vectors: { id: string; values: number[]; metadata: VectorMetadata }[]
): Promise<void> {
  if (vectors.length === 0) return;

  const index = getPineconeIndex().namespace(namespace);

  for (let i = 0; i < vectors.length; i += PINECONE_BATCH_SIZE) {
    const batch = vectors.slice(i, i + PINECONE_BATCH_SIZE);
    await index.upsert(
      batch.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata,
      }))
    );
  }
}

/**
 * Query vectors by similarity in a Pinecone namespace.
 *
 * @param namespace - Agent's Pinecone namespace
 * @param queryVector - The query embedding vector
 * @param topK - Number of results to return (default: 5)
 */
export async function queryVectors(
  namespace: string,
  queryVector: number[],
  topK: number = 5
): Promise<{ id: string; score: number; metadata: VectorMetadata }[]> {
  const index = getPineconeIndex().namespace(namespace);
  const result = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  return (result.matches || []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    metadata: match.metadata as VectorMetadata,
  }));
}

/**
 * Delete all vectors in a namespace (used for re-crawl cleanup).
 */
export async function deleteNamespace(namespace: string): Promise<void> {
  const index = getPineconeIndex().namespace(namespace);
  await index.deleteAll();
}
