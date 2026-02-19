// RAG Retriever — Query expansion + Pinecone search + Voyage reranker
// Flow: expand query → embed variants → search Pinecone → rerank → return top chunks

import { embedQuery } from '@/lib/voyage/embed';
import { queryVectors } from '@/lib/pinecone/index';
import { rerankDocuments } from '@/lib/voyage/rerank';

export interface RetrievalChunk {
  text: string;
  sourceUrl: string;
  pageTitle: string;
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievalChunk[];
  allChunks: RetrievalChunk[]; // All retrieved chunks (even low-scoring) for fallback system
  retrievalTimeMs: number;
}

// Simple synonym/keyword expansion map for common business queries
const QUERY_EXPANSIONS: Record<string, string[]> = {
  'pricing': ['price', 'cost', 'plan', 'subscription'],
  'price': ['pricing', 'cost', 'plan'],
  'cost': ['pricing', 'price', 'plan'],
  'refund': ['return policy', 'money back', 'cancellation'],
  'return': ['refund', 'money back', 'exchange'],
  'enterprise': ['large team', 'business plan', 'organization', 'scaling'],
  'large': ['enterprise', 'scaling', 'organization'],
  'scaling': ['enterprise', 'large', 'growing', 'growth'],
  'small': ['starter', 'individual', 'personal', 'basic'],
  'startup': ['growing', 'mid-size', 'small business'],
  'feature': ['capability', 'functionality', 'tool'],
  'integration': ['connect', 'plugin', 'extension', 'app'],
  'support': ['help', 'contact', 'assistance'],
  'contact': ['support', 'email', 'phone', 'reach'],
  'api': ['developer', 'integration', 'endpoint', 'sdk'],
  'security': ['privacy', 'compliance', 'sso', 'encryption'],
  'team': ['collaboration', 'workspace', 'organization'],
  'workflow': ['automation', 'process', 'pipeline'],
  'free': ['trial', 'demo', 'starter'],
};

/**
 * Expand a query with synonym/keyword variants.
 * No LLM needed — uses a static map of common business terms.
 */
function expandQuery(query: string): string[] {
  const variants = [query];
  const words = query.toLowerCase().split(/\s+/);

  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (QUERY_EXPANSIONS[clean]) {
      for (const synonym of QUERY_EXPANSIONS[clean].slice(0, 2)) {
        const variant = query.replace(new RegExp(word, 'i'), synonym);
        if (variant !== query && !variants.includes(variant)) {
          variants.push(variant);
        }
      }
    }
  }

  return variants.slice(0, 3);
}

/**
 * Retrieve relevant context chunks for a user query.
 * Uses query expansion + Pinecone vector search + Voyage reranker.
 *
 * @param agentId - Agent ID (for logging)
 * @param namespace - Pinecone namespace (agent-specific)
 * @param query - User's question text
 * @param topK - Number of final results to return (default: 5)
 * @returns Retrieved chunks with metadata and timing
 */
export async function retrieveContext(
  agentId: string,
  namespace: string,
  query: string,
  topK: number = 5
): Promise<RetrievalResult> {
  const startTime = Date.now();

  try {
    console.log(`[Retriever] Querying for agent ${agentId}: "${query.slice(0, 80)}..."`);

    // 1. Expand query with synonyms
    const queryVariants = expandQuery(query);
    console.log(`[Retriever] Query variants: ${queryVariants.length} (${queryVariants.join(' | ')})`);

    // 2. Embed all query variants
    const embeddings = await Promise.all(
      queryVariants.map(q => embedQuery(q))
    );

    // 3. Search Pinecone with each variant (topK=10 for pre-reranking pool)
    const candidateTopK = 10;
    const allResults = await Promise.all(
      embeddings.map(emb => queryVectors(namespace, emb, candidateTopK))
    );

    // 4. Merge and deduplicate (keep highest score per chunk ID)
    const mergedMap = new Map<string, { id: string; score: number; metadata: typeof allResults[0][0]['metadata'] }>();
    for (const results of allResults) {
      for (const r of results) {
        const existing = mergedMap.get(r.id);
        if (!existing || r.score > existing.score) {
          mergedMap.set(r.id, r);
        }
      }
    }

    // Pre-filter: only keep chunks with Pinecone score >= 0.25
    const candidates = Array.from(mergedMap.values())
      .filter(r => r.score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    console.log(`[Retriever] ${candidates.length} candidates after merge+filter`);

    // Build allChunks for fallback system (even low-scoring)
    const allChunks: RetrievalChunk[] = Array.from(mergedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => ({
        text: r.metadata.text,
        sourceUrl: r.metadata.sourceUrl,
        pageTitle: r.metadata.pageTitle,
        score: r.score,
      }));

    if (candidates.length === 0) {
      const retrievalTimeMs = Date.now() - startTime;
      console.log(`[Retriever] No candidates found in ${retrievalTimeMs}ms`);
      return { chunks: [], allChunks, retrievalTimeMs };
    }

    // 5. Rerank candidates using Voyage reranker
    let relevantChunks: RetrievalChunk[];

    try {
      const documentTexts = candidates.map(c => c.metadata.text);
      const rerankResults = await rerankDocuments(query, documentTexts, topK);

      console.log(`[Retriever] Reranker returned ${rerankResults.length} results`);

      // Map reranker results back to chunks, filter by reranker score >= 0.5
      // 0.5 threshold ensures only genuinely relevant chunks go to Gemini
      // Lower scores trigger fallback (saves Gemini credits on irrelevant queries)
      relevantChunks = rerankResults
        .filter(r => r.relevanceScore >= 0.5)
        .map(r => {
          const candidate = candidates[r.index];
          return {
            text: candidate.metadata.text,
            sourceUrl: candidate.metadata.sourceUrl,
            pageTitle: candidate.metadata.pageTitle,
            score: r.relevanceScore,
          };
        });
    } catch (rerankError) {
      // Fallback: if reranker fails, use Pinecone scores directly
      console.warn('[Retriever] Reranker failed, using vector scores:', rerankError);
      relevantChunks = candidates
        .slice(0, topK)
        .filter(r => r.score >= 0.4)
        .map(r => ({
          text: r.metadata.text,
          sourceUrl: r.metadata.sourceUrl,
          pageTitle: r.metadata.pageTitle,
          score: r.score,
        }));
    }

    const retrievalTimeMs = Date.now() - startTime;

    console.log(`[Retriever] Found ${relevantChunks.length} relevant chunks in ${retrievalTimeMs}ms`);
    if (relevantChunks.length > 0) {
      console.log(`[Retriever] Best score: ${relevantChunks[0].score.toFixed(3)} - "${relevantChunks[0].pageTitle}"`);
    }

    return {
      chunks: relevantChunks,
      allChunks,
      retrievalTimeMs,
    };
  } catch (error) {
    const retrievalTimeMs = Date.now() - startTime;
    console.error(`[Retriever] Error for agent ${agentId}:`, error);

    return {
      chunks: [],
      allChunks: [],
      retrievalTimeMs,
    };
  }
}
