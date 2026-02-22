// Database Layer — Talk to Site
// All database operations use the Supabase server client with RLS

import { createClient } from '@/lib/supabase/server';
import type { Agent, Profile, KnowledgePage, Conversation, Message, UsageDaily } from './types';

// ============ PROFILE OPERATIONS ============

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[DB] getProfile:', error);
    return null;
  }
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; avatar_url?: string }
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('[DB] updateProfile:', error);
    return null;
  }
  return data as Profile;
}

// ============ AGENT OPERATIONS ============

export async function getAgents(userId: string): Promise<Agent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DB] getAgents:', error);
    return [];
  }
  return (data ?? []) as Agent[];
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error) {
    console.error('[DB] getAgent:', error);
    return null;
  }
  return data as Agent;
}

export async function createAgent(agent: {
  user_id: string;
  name: string;
  website_url: string;
  greeting_message?: string;
  system_prompt?: string;
  voice_id?: string;
  avatar_face_id?: string;
  widget_color?: string;
  widget_position?: 'bottom-right' | 'bottom-left';
  widget_title?: string;
}): Promise<Agent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agents')
    .insert({
      ...agent,
      pinecone_namespace: crypto.randomUUID(),
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] createAgent:', error);
    return null;
  }
  return data as Agent;
}

export async function updateAgent(
  agentId: string,
  updates: Partial<Omit<Agent, 'id' | 'user_id' | 'created_at'>>
): Promise<Agent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single();

  if (error) {
    console.error('[DB] updateAgent:', error);
    return null;
  }
  return data as Agent;
}

export async function deleteAgent(agentId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from('agents').delete().eq('id', agentId);
  if (error) {
    console.error('[DB] deleteAgent:', error);
  }
  return !error;
}

// ============ KNOWLEDGE PAGE OPERATIONS ============

export async function getKnowledgePages(agentId: string): Promise<KnowledgePage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('knowledge_pages')
    .select('*')
    .eq('agent_id', agentId)
    .order('crawled_at', { ascending: false });

  if (error) {
    console.error('[DB] getKnowledgePages:', error);
    return [];
  }
  return (data ?? []) as KnowledgePage[];
}

export async function createKnowledgePage(page: {
  agent_id: string;
  source_url: string;
  page_title?: string;
  markdown_content?: string;
  content_hash?: string;
}): Promise<KnowledgePage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('knowledge_pages')
    .upsert(page, { onConflict: 'agent_id,source_url' })
    .select()
    .single();

  if (error) {
    console.error('[DB] createKnowledgePage:', error);
    return null;
  }
  return data as KnowledgePage;
}

export async function updateKnowledgePage(
  pageId: string,
  updates: Partial<Pick<KnowledgePage, 'status' | 'chunk_count' | 'error_message'>>
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('knowledge_pages')
    .update(updates)
    .eq('id', pageId);

  if (error) {
    console.error('[DB] updateKnowledgePage:', error);
  }
  return !error;
}

// ============ CONVERSATION OPERATIONS ============

export async function getConversations(agentId: string): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', agentId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[DB] getConversations:', error);
    return [];
  }
  return (data ?? []) as Conversation[];
}

export async function createConversation(conv: {
  agent_id: string;
  visitor_id: string;
  visitor_ip?: string;
  visitor_user_agent?: string;
  visitor_page_url?: string;
}): Promise<Conversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('conversations')
    .insert(conv)
    .select()
    .single();

  if (error) {
    console.error('[DB] createConversation:', error);
    return null;
  }
  return data as Conversation;
}

// ============ MESSAGE OPERATIONS ============

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DB] getMessages:', error);
    return [];
  }
  return (data ?? []) as Message[];
}

export async function createMessage(msg: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: object | null;
  cache_hit?: boolean;
  retrieval_time_ms?: number;
  generation_time_ms?: number;
}): Promise<Message | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert(msg)
    .select()
    .single();

  if (error) {
    console.error('[DB] createMessage:', error);
    return null;
  }
  return data as Message;
}

// ============ USAGE OPERATIONS ============

export async function incrementQueryCount(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_query_count', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[DB] incrementQueryCount:', error);
    return false;
  }
  return data as boolean;
}

export async function getUsageLast30Days(userId: string): Promise<UsageDaily[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('usage_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    console.error('[DB] getUsageLast30Days:', error);
    return [];
  }
  return (data ?? []) as UsageDaily[];
}
