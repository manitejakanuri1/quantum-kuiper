// Talk to Site — Core Type Definitions

export type Plan = 'starter' | 'growth' | 'professional' | 'business' | 'enterprise';
export type PlanStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type AgentStatus = 'pending' | 'crawling' | 'processing' | 'ready' | 'error';
export type KnowledgePageStatus = 'pending' | 'chunked' | 'embedded' | 'error';
export type MessageRole = 'user' | 'assistant' | 'system';
export type WidgetPosition = 'bottom-right' | 'bottom-left';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  plan: Plan;
  plan_status: PlanStatus;
  queries_today: number;
  queries_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  website_url: string;
  status: AgentStatus;
  greeting_message: string;
  system_prompt: string;
  voice_id: string;
  avatar_face_id: string;
  avatar_enabled: boolean;
  avatar_duration_limit: number;
  widget_color: string;
  widget_position: WidgetPosition;
  widget_title: string;
  pinecone_namespace: string | null;
  pages_crawled: number;
  chunks_created: number;
  last_crawled_at: string | null;
  crawl_error: string | null;
  extracted_info: ExtractedInfo | null;
  prompt_generated_at: string | null;
  prompt_customized: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExtractedInfo {
  company_name: string;
  company_description: string;
  products_services: string[];
  support_hours: string | null;
  tone: 'friendly' | 'professional' | 'casual' | 'formal';
  common_topics: string[];
  greeting: string;
  personality_description: string;
}

export interface KnowledgePage {
  id: string;
  agent_id: string;
  source_url: string;
  page_title: string | null;
  markdown_content: string | null;
  content_hash: string | null;
  chunk_count: number;
  status: KnowledgePageStatus;
  error_message: string | null;
  crawled_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  visitor_id: string;
  visitor_ip: string | null;
  visitor_user_agent: string | null;
  visitor_page_url: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  message_count: number;
  resolved: boolean | null;
  csat_rating: number | null;
  escalated: boolean;
  tts_characters: number;
  stt_minutes: number;
  avatar_minutes: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  total_cost_cents: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  sources: MessageSource[] | null;
  cache_hit: boolean;
  retrieval_time_ms: number | null;
  generation_time_ms: number | null;
  created_at: string;
}

export interface MessageSource {
  url: string;
  title: string;
  chunk_text: string;
  score: number;
}

export interface UsageDaily {
  id: string;
  user_id: string;
  date: string;
  queries_count: number;
  conversations_count: number;
  tts_characters: number;
  stt_minutes: number;
  avatar_minutes: number;
  llm_tokens: number;
  cache_hits: number;
  cache_misses: number;
  estimated_cost_cents: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan: Plan;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

// Plan limits
export const PLAN_LIMITS: Record<Plan, { queriesPerDay: number; maxWebsites: number }> = {
  starter: { queriesPerDay: 30, maxWebsites: 1 },
  growth: { queriesPerDay: 150, maxWebsites: 3 },
  professional: { queriesPerDay: 300, maxWebsites: 5 },
  business: { queriesPerDay: 1000, maxWebsites: 10 },
  enterprise: { queriesPerDay: 999999, maxWebsites: 999 },
};

// Available avatar faces
export interface Face {
  id: string;
  name: string;
  thumbnail: string;
  gender: 'male' | 'female';
}

// Available voices
export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  style: string;
  preview?: string;
  preview_url?: string;
}
