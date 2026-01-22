// Type definitions for the Voice Agent Platform
// Updated for Supabase integration

export interface User {
  id: string;
  email: string;
  password: string; // hashed
  name?: string;
  createdAt: Date;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  faceId?: string;
  voiceId?: string;
  websiteUrl?: string;
  systemPrompt?: string;
  status: 'active' | 'inactive' | 'training';
  crawlStatus?: 'pending' | 'crawling' | 'completed' | 'failed';
  crawlCompletedAt?: Date;
  pagesCrawled?: number;
  embedCode?: string;
  createdAt: Date;
  knowledgeBase?: KnowledgeBase;
}

export interface KnowledgeBase {
  id: string;
  agentId: string;
  sourceUrl?: string;
  status: 'processing' | 'ready' | 'error';
  chunks: DocumentChunk[];
  createdAt: Date;
}

export interface DocumentChunk {
  id: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

export interface Face {
  id: string;
  name: string;
  thumbnail: string;
  videoIdle: string;
  gender: 'male' | 'female';
  ethnicity: string;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  preview: string;
  style: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'ended';
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}
