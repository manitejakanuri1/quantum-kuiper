// Query Router — Regex-based intent classification
// Routes greetings and chitchat to canned responses, skipping RAG pipeline entirely
// $0 cost for non-website queries

export type QueryIntent = 'greeting' | 'farewell' | 'chitchat' | 'website_query';

export interface RouterResult {
  intent: QueryIntent;
  directResponse?: string;
}

const GREETING_PATTERNS = /^(hi|hello|hey|hii+|hola|howdy|good\s*(morning|afternoon|evening|day)|what'?s?\s*up|sup)\b/i;

const FAREWELL_PATTERNS = /^(bye|goodbye|good\s*bye|see\s*you|later|take\s*care|thanks|thank\s*you|thx|cheers|appreciate\s*it)\b/i;

const CHITCHAT_PATTERNS = /^(who\s*are\s*you|what\s*are\s*you|what\s*can\s*you\s*do|how\s*do\s*you\s*work|are\s*you\s*(a\s*bot|ai|real|human)|tell\s*me\s*about\s*yourself|what\s*is\s*your\s*name|what'?s?\s*your\s*name)\b/i;

/**
 * Route a query to determine intent and skip RAG when possible.
 *
 * @param query - The user's question/message
 * @param agentName - The agent's display name (for personalized responses)
 * @returns RouterResult with intent and optional direct response
 */
export function routeQuery(query: string, agentName: string): RouterResult {
  const trimmed = query.trim();

  if (GREETING_PATTERNS.test(trimmed)) {
    return {
      intent: 'greeting',
      directResponse: `Hi there! I'm the AI assistant for ${agentName}. How can I help you today?`,
    };
  }

  if (FAREWELL_PATTERNS.test(trimmed)) {
    return {
      intent: 'farewell',
      directResponse: `You're welcome! Feel free to come back anytime if you have more questions about ${agentName}. Have a great day!`,
    };
  }

  if (CHITCHAT_PATTERNS.test(trimmed)) {
    return {
      intent: 'chitchat',
      directResponse: `I'm an AI assistant trained on the ${agentName} website. I can answer questions about their products, services, pricing, and more. What would you like to know?`,
    };
  }

  return { intent: 'website_query' };
}
