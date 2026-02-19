// Supabase Database Types — Talk to Site
// Matches schema in supabase/migrations/001_foundation.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          stripe_customer_id: string | null;
          plan: 'starter' | 'growth' | 'professional' | 'business' | 'enterprise';
          plan_status: 'active' | 'past_due' | 'canceled' | 'trialing';
          queries_today: number;
          queries_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          plan?: 'starter' | 'growth' | 'professional' | 'business' | 'enterprise';
          plan_status?: 'active' | 'past_due' | 'canceled' | 'trialing';
          queries_today?: number;
          queries_reset_at?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          plan?: 'starter' | 'growth' | 'professional' | 'business' | 'enterprise';
          plan_status?: 'active' | 'past_due' | 'canceled' | 'trialing';
          queries_today?: number;
          queries_reset_at?: string;
          updated_at?: string;
        };
      };
      agents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          website_url: string;
          status: 'pending' | 'crawling' | 'processing' | 'ready' | 'error';
          greeting_message: string;
          system_prompt: string;
          voice_id: string;
          avatar_face_id: string;
          avatar_enabled: boolean;
          avatar_duration_limit: number;
          widget_color: string;
          widget_position: 'bottom-right' | 'bottom-left';
          widget_title: string;
          pinecone_namespace: string | null;
          pages_crawled: number;
          chunks_created: number;
          last_crawled_at: string | null;
          crawl_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          website_url: string;
          status?: 'pending' | 'crawling' | 'processing' | 'ready' | 'error';
          greeting_message?: string;
          system_prompt?: string;
          voice_id?: string;
          avatar_face_id?: string;
          avatar_enabled?: boolean;
          avatar_duration_limit?: number;
          widget_color?: string;
          widget_position?: 'bottom-right' | 'bottom-left';
          widget_title?: string;
          pinecone_namespace?: string | null;
        };
        Update: {
          name?: string;
          website_url?: string;
          status?: 'pending' | 'crawling' | 'processing' | 'ready' | 'error';
          greeting_message?: string;
          system_prompt?: string;
          voice_id?: string;
          avatar_face_id?: string;
          avatar_enabled?: boolean;
          avatar_duration_limit?: number;
          widget_color?: string;
          widget_position?: 'bottom-right' | 'bottom-left';
          widget_title?: string;
          pinecone_namespace?: string | null;
          pages_crawled?: number;
          chunks_created?: number;
          last_crawled_at?: string | null;
          crawl_error?: string | null;
          updated_at?: string;
        };
      };
      knowledge_pages: {
        Row: {
          id: string;
          agent_id: string;
          source_url: string;
          page_title: string | null;
          markdown_content: string | null;
          content_hash: string | null;
          chunk_count: number;
          status: 'pending' | 'chunked' | 'embedded' | 'error';
          error_message: string | null;
          crawled_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          source_url: string;
          page_title?: string | null;
          markdown_content?: string | null;
          content_hash?: string | null;
          chunk_count?: number;
          status?: 'pending' | 'chunked' | 'embedded' | 'error';
          error_message?: string | null;
        };
        Update: {
          page_title?: string | null;
          markdown_content?: string | null;
          content_hash?: string | null;
          chunk_count?: number;
          status?: 'pending' | 'chunked' | 'embedded' | 'error';
          error_message?: string | null;
        };
      };
      conversations: {
        Row: {
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
        };
        Insert: {
          id?: string;
          agent_id: string;
          visitor_id: string;
          visitor_ip?: string | null;
          visitor_user_agent?: string | null;
          visitor_page_url?: string | null;
        };
        Update: {
          ended_at?: string | null;
          duration_seconds?: number | null;
          message_count?: number;
          resolved?: boolean | null;
          csat_rating?: number | null;
          escalated?: boolean;
          tts_characters?: number;
          stt_minutes?: number;
          avatar_minutes?: number;
          llm_input_tokens?: number;
          llm_output_tokens?: number;
          total_cost_cents?: number;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          sources: Json | null;
          cache_hit: boolean;
          retrieval_time_ms: number | null;
          generation_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          sources?: Json | null;
          cache_hit?: boolean;
          retrieval_time_ms?: number | null;
          generation_time_ms?: number | null;
        };
        Update: {
          content?: string;
          sources?: Json | null;
        };
      };
      usage_daily: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
        };
        Update: {
          queries_count?: number;
          conversations_count?: number;
          tts_characters?: number;
          stt_minutes?: number;
          avatar_minutes?: number;
          llm_tokens?: number;
          cache_hits?: number;
          cache_misses?: number;
          estimated_cost_cents?: number;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          plan: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          plan: string;
          status: string;
        };
        Update: {
          stripe_price_id?: string;
          plan?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          updated_at?: string;
        };
      };
    };
    Functions: {
      increment_query_count: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
    };
  };
}
