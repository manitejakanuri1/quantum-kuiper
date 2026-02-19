// 3-Layer RAG Cache — Upstash Redis
// Layer 1: Exact match (hash of normalized query) — <1ms
// Layer 2: Semantic similarity (cosine > 0.95) — ~40ms
// Layer 3: Response cache (same retrieval chunks) — <1ms
// All operations gracefully degrade if Redis is unavailable.

import { Redis } from '@upstash/redis';
import type { MessageSource } from './types';

// ─── Redis Client (singleton, graceful fallback) ───

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ─── Types ───

export interface CacheResult {
  answer: string;
  sources: MessageSource[];
  layer: 1 | 2 | 3;
}

interface CachedEntry {
  answer: string;
  sources: MessageSource[];
  embedding: number[];
  chunksHash: string;
  timestamp: number;
}

// ─── Constants ───

const EXACT_TTL = 86400;       // 24 hours
const RESPONSE_TTL = 86400;    // 24 hours
const SEMANTIC_INDEX_TTL = 3600; // 1 hour (index lifetime, entries live in exact keys)
const SEMANTIC_MAX_ENTRIES = 100;
const SEMANTIC_THRESHOLD = 0.95;

// ─── Utilities ───

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Layer 1: Exact Match ───

export async function checkExactCache(
  agentId: string,
  query: string
): Promise<CacheResult | null> {
  try {
    const r = getRedis();
    if (!r) return null;

    const queryHash = await hashString(normalizeQuery(query));
    const key = `cache:v1:exact:${agentId}:${queryHash}`;
    const cached = await r.get<CachedEntry>(key);
    if (!cached) return null;

    console.log(`[Cache] Layer 1 HIT: exact match`);
    return { answer: cached.answer, sources: cached.sources, layer: 1 };
  } catch (err) {
    console.warn('[Cache] Layer 1 error (skipping):', err);
    return null;
  }
}

// ─── Layer 2: Semantic Similarity ───

export async function checkSemanticCache(
  agentId: string,
  queryEmbedding: number[]
): Promise<CacheResult | null> {
  try {
    const r = getRedis();
    if (!r) return null;

    const indexKey = `cache:v1:semindex:${agentId}`;
    const members = await r.zrange(indexKey, 0, -1) as string[];
    if (!members || members.length === 0) return null;

    // Pipeline fetch all cached entries
    const pipeline = r.pipeline();
    for (const hash of members) {
      pipeline.get(`cache:v1:exact:${agentId}:${hash}`);
    }
    const results = await pipeline.exec<(CachedEntry | null)[]>();

    // Find best match above threshold
    let best: { entry: CachedEntry; sim: number } | null = null;
    for (let i = 0; i < results.length; i++) {
      const entry = results[i];
      if (!entry?.embedding) continue;
      const sim = cosineSimilarity(queryEmbedding, entry.embedding);
      if (sim >= SEMANTIC_THRESHOLD && (!best || sim > best.sim)) {
        best = { entry, sim };
      }
    }

    if (!best) return null;

    console.log(`[Cache] Layer 2 HIT: semantic match (cosine=${best.sim.toFixed(4)})`);
    return { answer: best.entry.answer, sources: best.entry.sources, layer: 2 };
  } catch (err) {
    console.warn('[Cache] Layer 2 error (skipping):', err);
    return null;
  }
}

// ─── Layer 3: Response Cache (keyed on retrieval chunk identity) ───

export async function checkResponseCache(
  agentId: string,
  chunksHash: string
): Promise<CacheResult | null> {
  try {
    const r = getRedis();
    if (!r) return null;

    const key = `cache:v1:response:${agentId}:${chunksHash}`;
    const cached = await r.get<CachedEntry>(key);
    if (!cached) return null;

    console.log('[Cache] Layer 3 HIT: response cache (same chunks)');
    return { answer: cached.answer, sources: cached.sources, layer: 3 };
  } catch (err) {
    console.warn('[Cache] Layer 3 error (skipping):', err);
    return null;
  }
}

// ─── Write Cache (all 3 layers, fire-and-forget) ───

export async function writeCache(
  agentId: string,
  query: string,
  embedding: number[],
  answer: string,
  sources: MessageSource[],
  chunksHash: string
): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;

    const queryHash = await hashString(normalizeQuery(query));
    const entry: CachedEntry = {
      answer,
      sources,
      embedding,
      chunksHash,
      timestamp: Date.now(),
    };

    // Layer 1: exact match
    await r.set(`cache:v1:exact:${agentId}:${queryHash}`, entry, { ex: EXACT_TTL });

    // Layer 3: response cache
    await r.set(`cache:v1:response:${agentId}:${chunksHash}`, entry, { ex: RESPONSE_TTL });

    // Layer 2: add to semantic index (sorted set, score = timestamp)
    const indexKey = `cache:v1:semindex:${agentId}`;
    await r.zadd(indexKey, { score: entry.timestamp, member: queryHash });

    // Prune semantic index to max entries
    const count = await r.zcard(indexKey);
    if (count > SEMANTIC_MAX_ENTRIES) {
      await r.zremrangebyrank(indexKey, 0, count - SEMANTIC_MAX_ENTRIES - 1);
    }

    await r.expire(indexKey, SEMANTIC_INDEX_TTL);
  } catch (err) {
    console.warn('[Cache] Write error (non-fatal):', err);
  }
}

// ─── Hash Retrieval Chunks (for Layer 3 key) ───

export async function hashChunks(
  chunks: { sourceUrl: string; text: string; score: number }[]
): Promise<string> {
  const identity = chunks
    .map(c => `${c.sourceUrl}:${c.text.slice(0, 100)}:${c.score.toFixed(3)}`)
    .sort()
    .join('|');
  return hashString(identity);
}

// ─── Cache Invalidation (called on re-crawl) ───

export async function invalidateAgentCache(agentId: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;

    // Delete semantic index
    await r.del(`cache:v1:semindex:${agentId}`);

    // Scan and delete all exact + response keys for this agent
    let cursor = 0;
    do {
      const [nextCursor, keys] = await r.scan(cursor, {
        match: `cache:v1:*:${agentId}:*`,
        count: 100,
      });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await r.del(...(keys as string[]));
      }
    } while (cursor !== 0);

    console.log(`[Cache] Invalidated all cache for agent ${agentId}`);
  } catch (err) {
    console.warn('[Cache] Invalidation error (non-fatal):', err);
  }
}
