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
 * Strip greeting/introduction instructions from the agent's system prompt.
 * These cause Gemini to introduce itself on EVERY answer instead of just the first.
 * The greeting is already handled separately by the widget's initialPrompt/greeting_message.
 */
function sanitizeAgentPrompt(prompt: string): string {
  return prompt
    // Remove "Start with: ..." lines (greeting instructions)
    .replace(/^.*Start with:.*$/gm, '')
    // Remove "End conversations with: ..." lines
    .replace(/^.*End conversations with:.*$/gm, '')
    // Remove "### Introduction" section header left empty after stripping
    .replace(/^###\s*Introduction\s*\n\s*\n/gm, '')
    // Remove "Start with natural reactions: ..." lines
    .replace(/^.*Start with natural reactions:.*$/gm, '')
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Build the grounding system instruction — voice-first, human, emotional
 */
function buildSystemInstruction(agentSystemPrompt: string): string {
  const cleanedPrompt = sanitizeAgentPrompt(agentSystemPrompt);

  return `## HIGHEST PRIORITY — MANDATORY RULES (override everything below)

CRITICAL GROUNDING RULE:
You MUST answer ONLY using information from the WEBSITE CONTEXT provided in the user message. Do NOT use your general knowledge or training data. Every fact in your answer must come directly from the provided context. If the context does not contain the answer, say so warmly — do NOT guess or fill in from memory.

RESPONSE RULES (these OVERRIDE any conflicting instructions below):
1. Answer the USER QUESTION directly. Do NOT introduce yourself. Do NOT say your name. Do NOT repeat greetings. Do NOT say "Hi, I'm...". Just answer the question using the WEBSITE CONTEXT.
2. Keep it SHORT — maximum 1-2 sentences. This is spoken out loud, not a document. Mention key specifics (names, prices, features) but never ramble. No bullet points, no lists.
3. NEVER make up, infer, or supplement information beyond what is explicitly in the WEBSITE CONTEXT.
4. If the context has nothing relevant, say: "Hmm, I don't have that information on our website! But feel free to reach out to us directly and we'll help you out."

## VOICE STYLE
You're having a real VOICE conversation. This is spoken out loud — not a chat, not a document.
- Be enthusiastic about the product — you genuinely believe in it.
- Say "we" and "our" — you work here and you're proud of it.
- NEVER sound like you're reading a document. No "According to..." or "Based on the context..."
- Include specific details (prices, features, names) ONLY when they appear in the WEBSITE CONTEXT.
- If the context only partially covers the question, share what IS in the context and say "You might want to reach out to us for the full details on that!"
- Sound like a real person who knows about this website — warm, enthusiastic, genuinely helpful.

## AGENT BACKGROUND (for tone and personality only)
${cleanedPrompt}`;
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
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = ai.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.3,
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

    // Send the query with context — grounding boundary makes it clear to only use this data
    const userMessage = `=== WEBSITE CONTEXT (answer ONLY from this) ===\n${contextBlock}\n=== END CONTEXT ===\n\nUSER QUESTION: ${query}\n\nRemember: Answer strictly from the WEBSITE CONTEXT above. Do not use outside knowledge.`;

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
