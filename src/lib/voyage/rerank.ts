// Voyage AI Reranker — REST API client
// Model: rerank-2.5-lite
// Uses same VOYAGE_API_KEY as embeddings
// Endpoint: POST https://api.voyageai.com/v1/rerank

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank';
const VOYAGE_RERANK_MODEL = 'rerank-2.5-lite';

export interface RerankResult {
  index: number;
  relevanceScore: number;
}

/**
 * Rerank documents by relevance to a query using Voyage AI reranker.
 *
 * @param query - The search query
 * @param documents - Array of document texts to rerank
 * @param topK - Number of top results to return (default: all)
 * @returns Array of results sorted by descending relevance score
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  topK?: number
): Promise<RerankResult[]> {
  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY not configured');
  }

  if (documents.length === 0) return [];

  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      response = await fetch(VOYAGE_RERANK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: VOYAGE_RERANK_MODEL,
          query,
          documents,
          top_k: topK,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok || (response.status < 429 && response.status !== 408)) break;
    if (attempt === 0) {
      console.warn(`[Voyage Rerank] Retrying after ${response.status}...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!response || !response.ok) {
    const errorBody = response ? await response.text() : 'Request aborted';
    throw new Error(`Voyage Rerank API error ${response?.status ?? 'timeout'}: ${errorBody}`);
  }

  const data = await response.json();

  // Response: { data: [{ index, relevance_score }], model, usage: { total_tokens } }
  return (data.data || []).map(
    (item: { index: number; relevance_score: number }) => ({
      index: item.index,
      relevanceScore: item.relevance_score,
    })
  );
}
