// RAG Generator — Gemini 2.0 Flash for grounded answer generation

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { MessageSource } from '@/lib/types';
import type { RetrievalChunk } from './retriever';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('[Generator] GOOGLE_GENERATIVE_AI_API_KEY not configured');
}

// Singleton Gemini client
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

export interface GenerationResult {
  answer: string;
  sources: MessageSource[];
  generationTimeMs: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Build the context block from retrieved chunks
 * Formats chunks as numbered sources for the LLM
 */
function buildContextBlock(chunks: RetrievalChunk[]): string {
  if (chunks.length === 0) return 'No relevant information found.';

  return chunks
    .map((chunk, i) => {
      return `[Source ${i + 1}] (${chunk.pageTitle} — ${chunk.sourceUrl})\n${chunk.text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Build the grounding system instruction — voice-first, human, emotional
 */
function buildSystemInstruction(agentSystemPrompt: string): string {
  return `${agentSystemPrompt}

You're having a real VOICE conversation. This is spoken out loud — not a chat, not a document. Talk like a warm, friendly human who genuinely loves helping people.

VOICE RULES:
1. Keep it SHORT. 1-2 sentences for simple questions, 2-3 sentences MAX for complex ones. People are listening, not reading.
2. Start with a natural human reaction: "Great question!", "Oh absolutely!", "Sure thing!", "Yeah, so..."
3. Be enthusiastic about the product — you genuinely believe in it.
4. Say "we" and "our" — you work here and you're proud of it.
5. NEVER sound like you're reading a document. No bullet points, no numbered lists, no "According to..." or "Based on the context..."
6. Include specific details (prices, features, names) when they're in the context — weave them naturally into speech.
7. If the context partially answers, share what you know and say "You might want to reach out to us for the full details on that!"
8. ONLY say you don't know if the context has absolutely nothing relevant — and be warm: "Hmm, I'm not sure about that one! But feel free to reach out to us directly."
9. Never make up information that isn't in the context.
10. Sound like a real person who happens to know a lot — not an AI reading from a database.

EMOTION: Warm, enthusiastic, genuinely helpful. Like talking to a friendly colleague who loves their job.`;
}

/**
 * Generate a grounded answer using Gemini 2.0 Flash
 *
 * @param systemPrompt - Agent's custom system prompt
 * @param context - Retrieved chunks from Pinecone
 * @param query - User's question
 * @param conversationHistory - Last few messages for continuity
 * @returns Generated answer with sources and token usage
 */
export async function generateAnswer(
  systemPrompt: string,
  context: RetrievalChunk[],
  query: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<GenerationResult> {
  const startTime = Date.now();

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.5,
      },
      systemInstruction: buildSystemInstruction(systemPrompt),
    });

    // Build the prompt with context
    const contextBlock = buildContextBlock(context);

    // Build conversation history for multi-turn
    const historyMessages = (conversationHistory || [])
      .slice(-6) // Last 3 exchanges (6 messages)
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: msg.content }],
      }));

    // Create chat session with history
    const chat = model.startChat({
      history: historyMessages,
    });

    // Send the query with context
    const userMessage = `WEBSITE CONTEXT:\n${contextBlock}\n\nUSER QUESTION: ${query}`;

    console.log(`[Generator] Sending to Gemini (${context.length} context chunks)...`);

    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const answer = response.text();

    // Extract token usage
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Build sources from retrieved chunks
    const sources: MessageSource[] = context.map(chunk => ({
      url: chunk.sourceUrl,
      title: chunk.pageTitle,
      chunk_text: chunk.text.slice(0, 200), // Truncate for storage
      score: chunk.score,
    }));

    const generationTimeMs = Date.now() - startTime;

    console.log(`[Generator] Answer generated in ${generationTimeMs}ms (${inputTokens}/${outputTokens} tokens)`);

    return {
      answer,
      sources,
      generationTimeMs,
      inputTokens,
      outputTokens,
    };
  } catch (error) {
    const generationTimeMs = Date.now() - startTime;
    console.error('[Generator] Gemini error:', error);

    return {
      answer: "I'm sorry, I'm having trouble generating a response right now. Could you try asking again?",
      sources: [],
      generationTimeMs,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
