// Fallback System — Provides helpful responses when RAG can't answer
// Never returns a dead-end "I don't know" — always suggests a next step

import type { RetrievalChunk } from './retriever';

export interface FallbackResult {
  answer: string;
  suggestedPage?: { title: string; url: string };
}

/**
 * Build a helpful fallback response when the RAG pipeline can't find a confident answer.
 *
 * @param chunks - All retrieved chunks (even low-scoring ones)
 * @param query - The user's original question
 * @param agentName - The agent's display name
 * @param websiteUrl - The agent's website URL
 * @returns Fallback response with optional page suggestion
 */
export function buildFallbackResponse(
  chunks: RetrievalChunk[],
  query: string,
  agentName: string,
  websiteUrl: string
): FallbackResult {
  // Find the best chunk even if it's low-scoring
  const bestChunk = chunks.length > 0
    ? chunks.reduce((best, chunk) => chunk.score > best.score ? chunk : best, chunks[0])
    : null;

  if (bestChunk && bestChunk.score >= 0.35) {
    // Check for keyword overlap to avoid suggesting unrelated pages
    // e.g. don't suggest "Why is quality so rare?" for "How to make chicken curry"
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);
    const chunkTextLower = (bestChunk.text + ' ' + bestChunk.pageTitle).toLowerCase();
    const hasOverlap = queryTerms.some(term => chunkTextLower.includes(term));

    if (hasOverlap) {
      return {
        answer: `I don't have the exact details on that, but you might find it on the "${bestChunk.pageTitle}" page. You can also visit ${websiteUrl} for more information.`,
        suggestedPage: {
          title: bestChunk.pageTitle,
          url: bestChunk.sourceUrl,
        },
      };
    }
  }

  // Completely irrelevant — politely redirect
  return {
    answer: `That doesn't seem to be covered on this website. I can only answer questions about ${agentName}. Is there something else about ${agentName} I can help with?`,
  };
}
