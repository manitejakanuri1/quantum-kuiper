// Conversation API — Public endpoint for widget visitors
// POST /api/agents/[id]/converse
// Pipeline: router → cache (3 layers) → retrieval (expansion + rerank) → generation or fallback

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { routeQuery } from '@/lib/rag/router';
import { retrieveContext } from '@/lib/rag/retriever';
import { generateAnswer } from '@/lib/rag/generator';
import { buildFallbackResponse } from '@/lib/rag/fallback';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import {
  checkExactCache, checkSemanticCache, checkResponseCache,
  writeCache, hashChunks,
  type CacheResult,
} from '@/lib/cache';
import { embedQuery } from '@/lib/voyage/embed';
import type { Agent } from '@/lib/types';
import { requireJsonContentType } from '@/lib/request-validation';

// CORS headers for cross-origin widget/embed access
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 20 requests per minute per IP (most expensive endpoint)
  const rateLimitResult = await rateLimit(
    `converse:${getClientIdentifier(request)}`,
    { max: 20, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  const { id: agentId } = await params;

  try {
    // 0. Validate Content-Type
    const contentTypeError = requireJsonContentType(request);
    if (contentTypeError) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415, headers: CORS_HEADERS }
      );
    }

    // 1. Parse request body (with safe JSON parsing)
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const query = typeof body.query === 'string' ? body.query : '';
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined;
    const visitorId = typeof body.visitorId === 'string'
      ? body.visitorId.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 256)
      : undefined;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (query.length > 2000) {
      return NextResponse.json(
        { error: 'Query too long (max 2000 characters)' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Fetch agent using admin client (public endpoint, no user auth)
    const supabase = createAdminClient();

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const typedAgent = agent as Agent;

    if (typedAgent.status !== 'ready') {
      return NextResponse.json(
        { error: 'Agent is not available' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!typedAgent.pinecone_namespace) {
      return NextResponse.json(
        { error: 'Agent has no knowledge base configured' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Query router — skip RAG for greetings/chitchat ($0 cost)
    const routerResult = routeQuery(query.trim(), typedAgent.name);

    if (routerResult.intent !== 'website_query' && routerResult.directResponse) {
      console.log(`[Converse] Routed as ${routerResult.intent} — skipping RAG`);

      // Save conversation even for routed queries
      let activeConversationId = await validateConversationId(supabase, conversationId, agentId);
      if (!activeConversationId) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            agent_id: agentId,
            visitor_id: visitorId || `anon-${Date.now()}`,
          })
          .select('id')
          .single();
        if (newConv) activeConversationId = newConv.id;
      }

      if (activeConversationId) {
        await supabase.from('messages').insert([
          {
            conversation_id: activeConversationId,
            role: 'user',
            content: query.trim(),
            cache_hit: false,
          },
          {
            conversation_id: activeConversationId,
            role: 'assistant',
            content: routerResult.directResponse,
            cache_hit: false,
          },
        ]);
      }

      return NextResponse.json({
        answer: routerResult.directResponse,
        sources: [],
        conversationId: activeConversationId,
        retrievalTimeMs: 0,
        generationTimeMs: 0,
        tokensUsed: { input: 0, output: 0 },
        routed: routerResult.intent,
      }, { headers: CORS_HEADERS });
    }

    // 4. Cache Layer 1: Exact match (<1ms, $0 cost)
    const trimmedQuery = query.trim();
    const exactHit = await checkExactCache(agentId, trimmedQuery);
    if (exactHit) {
      console.log('[Converse] Cache Layer 1 HIT — returning cached answer');
      const cacheConvId = await saveConversationAndMessages(
        supabase, agentId, visitorId, conversationId, trimmedQuery, exactHit.answer, exactHit.sources, true
      );
      return NextResponse.json({
        answer: exactHit.answer,
        sources: exactHit.sources,
        conversationId: cacheConvId,
        retrievalTimeMs: 0,
        generationTimeMs: 0,
        tokensUsed: { input: 0, output: 0 },
        cacheHit: true,
        cacheLayer: 1,
      }, { headers: CORS_HEADERS });
    }

    // 5. Embed query (needed for Layer 2 cache + RAG retrieval)
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await embedQuery(trimmedQuery);
    } catch (embedErr) {
      console.warn('[Converse] Embedding failed (skipping Layer 2 cache):', embedErr);
    }

    // 6. Cache Layer 2: Semantic similarity (~40ms, $0 cost)
    if (queryEmbedding) {
      const semanticHit = await checkSemanticCache(agentId, queryEmbedding);
      if (semanticHit) {
        console.log('[Converse] Cache Layer 2 HIT — returning semantically cached answer');
        const cacheConvId = await saveConversationAndMessages(
          supabase, agentId, visitorId, conversationId, trimmedQuery, semanticHit.answer, semanticHit.sources, true
        );
        return NextResponse.json({
          answer: semanticHit.answer,
          sources: semanticHit.sources,
          conversationId: cacheConvId,
          retrievalTimeMs: 0,
          generationTimeMs: 0,
          tokensUsed: { input: 0, output: 0 },
          cacheHit: true,
          cacheLayer: 2,
        }, { headers: CORS_HEADERS });
      }
    }

    // 7. Get conversation history if continuing a conversation
    //    SECURITY: Validate conversationId belongs to this agent before fetching messages
    let conversationHistory: { role: string; content: string }[] = [];
    let activeConversationId = await validateConversationId(supabase, conversationId, agentId);

    if (activeConversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true })
        .limit(6);

      if (messages) {
        conversationHistory = messages.map(m => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    // 8. RAG retrieval — search Pinecone with expansion + reranking
    const retrieval = await retrieveContext(
      agentId,
      typedAgent.pinecone_namespace,
      trimmedQuery
    );

    // 9. Cache Layer 3: Response cache — same retrieval chunks (<1ms)
    let chunksHash: string | null = null;
    if (retrieval.chunks.length > 0) {
      chunksHash = await hashChunks(retrieval.chunks);
      const responseHit = await checkResponseCache(agentId, chunksHash);
      if (responseHit) {
        console.log('[Converse] Cache Layer 3 HIT — same chunks, returning cached generation');
        const cacheConvId = await saveConversationAndMessages(
          supabase, agentId, visitorId, conversationId, trimmedQuery, responseHit.answer, responseHit.sources, true,
          retrieval.retrievalTimeMs
        );
        return NextResponse.json({
          answer: responseHit.answer,
          sources: responseHit.sources,
          conversationId: cacheConvId,
          retrievalTimeMs: retrieval.retrievalTimeMs,
          generationTimeMs: 0,
          tokensUsed: { input: 0, output: 0 },
          cacheHit: true,
          cacheLayer: 3,
        }, { headers: CORS_HEADERS });
      }
    }

    // 10. Decide: generate answer or use fallback
    let answer: string;
    let sources = retrieval.chunks.map(c => ({
      url: c.sourceUrl,
      title: c.pageTitle,
      chunk_text: c.text.slice(0, 200),
      score: c.score,
    }));
    let generationTimeMs = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let usedFallback = false;

    if (retrieval.chunks.length > 0) {
      // Good retrieval — call Gemini
      const generation = await generateAnswer(
        typedAgent.system_prompt,
        retrieval.chunks,
        trimmedQuery,
        conversationHistory
      );

      answer = generation.answer;
      sources = generation.sources;
      generationTimeMs = generation.generationTimeMs;
      inputTokens = generation.inputTokens;
      outputTokens = generation.outputTokens;

      // Write to all 3 cache layers (fire-and-forget, non-blocking)
      if (queryEmbedding && chunksHash) {
        void writeCache(agentId, trimmedQuery, queryEmbedding, answer, sources, chunksHash);
      }
    } else {
      // No confident chunks — use fallback (skip Gemini, save credits)
      console.log('[Converse] No confident chunks — using fallback (skipping Gemini)');
      const fallback = buildFallbackResponse(
        retrieval.allChunks,
        trimmedQuery,
        typedAgent.name,
        typedAgent.website_url
      );
      answer = fallback.answer;
      usedFallback = true;

      // Log unanswered question
      const bestScore = retrieval.allChunks.length > 0
        ? retrieval.allChunks[0].score
        : 0;

      try {
        // Check if similar question exists (simple text match)
        const normalizedQuestion = trimmedQuery.toLowerCase();
        const { data: existing } = await supabase
          .from('unanswered_questions')
          .select('id, times_asked')
          .eq('agent_id', agentId)
          .ilike('question', normalizedQuestion)
          .single();

        if (existing) {
          await supabase
            .from('unanswered_questions')
            .update({
              times_asked: existing.times_asked + 1,
              best_similarity_score: bestScore,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('unanswered_questions').insert({
            agent_id: agentId,
            question: trimmedQuery,
            best_similarity_score: bestScore,
          });
        }
      } catch (logError) {
        // Non-critical — don't fail the request
        console.warn('[Converse] Failed to log unanswered question:', logError);
      }
    }

    // 11. Save conversation + messages to Supabase
    if (!activeConversationId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          agent_id: agentId,
          visitor_id: visitorId || `anon-${Date.now()}`,
        })
        .select('id')
        .single();

      if (newConv) {
        activeConversationId = newConv.id;
      }
    }

    if (activeConversationId) {
      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        role: 'user',
        content: trimmedQuery,
        cache_hit: false,
        retrieval_time_ms: retrieval.retrievalTimeMs,
      });

      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        role: 'assistant',
        content: answer,
        sources: sources,
        cache_hit: false,
        generation_time_ms: generationTimeMs,
      });

      await supabase
        .from('conversations')
        .update({ message_count: conversationHistory.length + 2 })
        .eq('id', activeConversationId);
    }

    // 12. Return response
    return NextResponse.json({
      answer,
      sources,
      conversationId: activeConversationId,
      retrievalTimeMs: retrieval.retrievalTimeMs,
      generationTimeMs,
      tokensUsed: { input: inputTokens, output: outputTokens },
      usedFallback,
      cacheHit: false,
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error('[Converse] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Helper: Save conversation + user/assistant messages (used by cache hits and normal flow).
 * Returns the conversationId for the response.
 */
async function saveConversationAndMessages(
  supabase: ReturnType<typeof createAdminClient>,
  agentId: string,
  visitorId: string | undefined,
  conversationId: string | undefined,
  query: string,
  answer: string,
  sources: unknown[],
  cacheHit: boolean,
  retrievalTimeMs?: number
): Promise<string | undefined> {
  let activeConvId = await validateConversationId(supabase, conversationId, agentId);

  if (!activeConvId) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        agent_id: agentId,
        visitor_id: visitorId || `anon-${Date.now()}`,
      })
      .select('id')
      .single();
    if (newConv) activeConvId = newConv.id;
  }

  if (activeConvId) {
    await supabase.from('messages').insert([
      {
        conversation_id: activeConvId,
        role: 'user',
        content: query,
        cache_hit: cacheHit,
        retrieval_time_ms: retrievalTimeMs ?? 0,
      },
      {
        conversation_id: activeConvId,
        role: 'assistant',
        content: answer,
        sources,
        cache_hit: cacheHit,
        generation_time_ms: 0,
      },
    ]);
  }

  return activeConvId;
}

/**
 * Validate that a conversationId belongs to the given agentId.
 * Prevents cross-agent conversation history leaks.
 * Returns the conversationId if valid, or undefined if invalid/missing.
 */
async function validateConversationId(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string | undefined,
  agentId: string
): Promise<string | undefined> {
  if (!conversationId) return undefined;

  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('agent_id', agentId)
    .single();

  return data?.id || undefined;
}
