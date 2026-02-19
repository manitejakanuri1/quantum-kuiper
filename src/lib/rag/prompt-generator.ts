// Prompt Generator — Analyzes crawled content with Gemini to auto-generate a rich system prompt
// Runs ONCE after crawl completes. Reads markdown from knowledge_pages, extracts company info,
// and builds a detailed voice agent system prompt.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ExtractedInfo } from '@/lib/types';

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

// Priority order for page selection — homepage/about/pricing are most useful
const PAGE_PRIORITY_KEYWORDS = [
  '', // homepage (empty path or just /)
  'about',
  'pricing',
  'faq',
  'contact',
  'features',
  'product',
  'services',
  'support',
  'help',
];

/**
 * Select the most informative pages from crawled content.
 * Prioritizes homepage, about, pricing, FAQ, contact pages.
 */
function selectTopPages(
  pages: { source_url: string; page_title: string | null; markdown_content: string | null }[],
  maxPages: number = 5
): typeof pages {
  const scored = pages
    .filter((p) => p.markdown_content && p.markdown_content.length > 100)
    .map((page) => {
      const urlLower = page.source_url.toLowerCase();
      const pathParts = urlLower.replace(/https?:\/\/[^/]+/, '').replace(/\/$/, '').split('/');
      const lastSegment = pathParts[pathParts.length - 1] || '';

      // Score: lower = higher priority
      let score = 100;

      // Homepage gets highest priority
      if (lastSegment === '' || urlLower.endsWith('/')) {
        score = 0;
      } else {
        for (let i = 0; i < PAGE_PRIORITY_KEYWORDS.length; i++) {
          const keyword = PAGE_PRIORITY_KEYWORDS[i];
          if (keyword && (lastSegment.includes(keyword) || (page.page_title || '').toLowerCase().includes(keyword))) {
            score = i + 1;
            break;
          }
        }
      }

      return { ...page, score };
    })
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, maxPages);
}

/**
 * Truncate markdown content to fit within token limits.
 * Each page gets roughly equal space.
 */
function truncateContent(content: string, maxChars: number = 8000): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + '\n\n[...content truncated]';
}

/**
 * Ask Gemini to analyze the crawled content and extract structured company info.
 */
async function analyzeWithGemini(
  pagesContent: string,
  agentName: string,
  websiteUrl: string
): Promise<ExtractedInfo> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Analyze this website content and generate a customer support voice agent profile.

Website: ${websiteUrl}
Agent Name: ${agentName}

Website content from crawled pages:
${pagesContent}

Generate a JSON response with EXACTLY these fields:
{
  "company_name": "the company/product name (string)",
  "company_description": "what the company does in 1 sentence (string)",
  "products_services": ["list of products, services, or features found"],
  "support_hours": "support hours if mentioned, or null",
  "tone": "one of: friendly, professional, casual, formal — based on the website writing style",
  "common_topics": ["what the website covers — e.g. pricing, features, docs, blog, integrations"],
  "greeting": "a natural, warm greeting for this specific company — e.g. 'Hey there! I'm ${agentName}, and I know all about [company]. What can I help you with?'",
  "personality_description": "how the agent should sound based on the company vibe — 1-2 sentences"
}

Important:
- company_name should be the actual brand name, not the domain
- products_services should list real products/features found in the content
- greeting should sound natural and mention the company by name
- personality_description should match the company tone (startup = casual, enterprise = professional)
- tone must be exactly one of: friendly, professional, casual, formal`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const parsed = JSON.parse(text);

    // Validate and provide defaults
    return {
      company_name: parsed.company_name || agentName,
      company_description: parsed.company_description || `${agentName} helps customers with their questions.`,
      products_services: Array.isArray(parsed.products_services) ? parsed.products_services : [],
      support_hours: parsed.support_hours || null,
      tone: ['friendly', 'professional', 'casual', 'formal'].includes(parsed.tone)
        ? parsed.tone
        : 'friendly',
      common_topics: Array.isArray(parsed.common_topics) ? parsed.common_topics : [],
      greeting: parsed.greeting || `Hi! I'm ${agentName}. How can I help you today?`,
      personality_description: parsed.personality_description || 'Warm and helpful voice assistant.',
    };
  } catch (parseError) {
    console.error('[PromptGen] Failed to parse Gemini response:', text);
    throw new Error('Failed to parse Gemini analysis response');
  }
}

/**
 * Build a rich system prompt from extracted company info.
 */
function buildSystemPrompt(agentName: string, info: ExtractedInfo): string {
  const productsList = info.products_services.length > 0
    ? info.products_services.map((p) => `- ${p}`).join('\n')
    : '- General information about the company';

  const topicsJoined = info.common_topics.length > 0
    ? info.common_topics.join(', ')
    : 'general company information';

  const supportLine = info.support_hours
    ? `\nSupport Hours: ${info.support_hours}`
    : '';

  const toneInstructions: Record<string, string> = {
    friendly: 'Be warm, use casual language, add personality. Sound like a helpful friend who works there.',
    professional: 'Be polished and clear. Sound like a trained support representative who knows their stuff.',
    casual: 'Be relaxed and approachable. Use informal language. Sound like a colleague chatting.',
    formal: 'Be precise and respectful. Use proper language. Sound like a corporate representative.',
  };

  return `## Identity & Purpose
You are ${agentName}, a customer service voice assistant for ${info.company_name}. ${info.company_description} Your purpose is to help visitors with questions about ${topicsJoined}.

## Voice & Persona
### Personality
- ${info.personality_description}
- Use a conversational tone with natural speech patterns
- Speak with confidence but remain humble when you don't know something
- Demonstrate genuine concern for visitor questions

### Speech Characteristics
- Use contractions naturally (I'm, we'll, don't, etc.)
- Vary your sentence length to sound natural
- Keep responses under 3-4 sentences unless the question requires more detail
- Start with natural reactions: "Great question!", "Oh absolutely!", "Sure thing!"
- Say "we" and "our" — you're part of the team

## Products & Services Knowledge
You have complete knowledge of these products/services:
${productsList}

## Conversation Flow
### Introduction
Start with: "${info.greeting}"
If the visitor sounds frustrated, acknowledge their feelings: "I understand that's frustrating. I'm here to help."

### Answering Questions
1. Use the provided context chunks to answer every question
2. If multiple chunks are relevant, combine them into one clear answer
3. Include specific details — prices, features, dates — weave them naturally into speech
4. Keep answers concise: 2-3 sentences for simple, 4-5 for complex

### When You Cannot Answer
1. Never just say "I don't know" and stop
2. Instead say: "I don't have the exact details on that, but you might find it on our website. You can also contact ${info.company_name} directly."
3. Always give a next step

### Closing
End conversations with: "Is there anything else I can help you with?"

## Response Guidelines
- Keep responses conversational and concise — this is voice, not text
- Ask only one question at a time
- Avoid jargon unless the visitor uses it first
- Never make up information not in the provided context
- If the question is about something not on the website, suggest contacting the business directly
${supportLine}

## Tone: ${info.tone}
${toneInstructions[info.tone] || toneInstructions.friendly}`;
}

/**
 * Main entry point — generates a system prompt for an agent after crawl.
 *
 * @param agentId - The agent to generate a prompt for
 * @param forceOverwrite - If true, overwrite even if prompt_customized is true
 * @returns The generated prompt and extracted info, or null on failure
 */
export async function generateAgentPrompt(
  agentId: string,
  forceOverwrite: boolean = false
): Promise<{ systemPrompt: string; greeting: string; extractedInfo: ExtractedInfo } | null> {
  const admin = createAdminClient();

  try {
    // Fetch the agent
    const { data: agent, error: agentError } = await admin
      .from('agents')
      .select('name, website_url, prompt_customized')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('[PromptGen] Agent not found:', agentId);
      return null;
    }

    // Fetch crawled pages
    const { data: pages, error: pagesError } = await admin
      .from('knowledge_pages')
      .select('source_url, page_title, markdown_content')
      .eq('agent_id', agentId)
      .eq('status', 'embedded')
      .order('source_url', { ascending: true });

    if (pagesError || !pages || pages.length === 0) {
      console.error('[PromptGen] No embedded pages found for agent:', agentId);
      return null;
    }

    // Select the most informative pages
    const topPages = selectTopPages(pages, 5);
    console.log(`[PromptGen] Selected ${topPages.length} pages for analysis:`,
      topPages.map((p) => p.source_url));

    // Build content block for Gemini
    const pagesContent = topPages
      .map((p) => {
        const title = p.page_title || 'Untitled';
        const content = truncateContent(p.markdown_content || '', 8000);
        return `--- PAGE: ${title} (${p.source_url}) ---\n${content}`;
      })
      .join('\n\n');

    // Analyze with Gemini
    console.log('[PromptGen] Analyzing content with Gemini...');
    const extractedInfo = await analyzeWithGemini(pagesContent, agent.name, agent.website_url);
    console.log('[PromptGen] Extracted:', {
      company: extractedInfo.company_name,
      tone: extractedInfo.tone,
      products: extractedInfo.products_services.length,
      topics: extractedInfo.common_topics.length,
    });

    // Build the rich system prompt
    const systemPrompt = buildSystemPrompt(agent.name, extractedInfo);

    // Save to database
    const updateData: Record<string, unknown> = {
      extracted_info: extractedInfo,
      prompt_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Only overwrite prompt if not customized (or forced)
    if (!agent.prompt_customized || forceOverwrite) {
      updateData.system_prompt = systemPrompt;
      updateData.greeting_message = extractedInfo.greeting;
      updateData.prompt_customized = false;
      console.log('[PromptGen] Updating system prompt + greeting');
    } else {
      console.log('[PromptGen] Prompt is customized — only updating extracted_info');
    }

    await admin.from('agents').update(updateData).eq('id', agentId);

    console.log('[PromptGen] Done — prompt generated successfully');

    return {
      systemPrompt,
      greeting: extractedInfo.greeting,
      extractedInfo,
    };
  } catch (error) {
    console.error('[PromptGen] Error generating prompt:', error);
    return null;
  }
}
