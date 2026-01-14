// Supabase Client Configuration
// Auto-connects using environment variables after initial setup

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials not configured. Using in-memory fallback.');
}

// Create Supabase client - auto-connects on first use
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Database types for TypeScript
export interface DbUser {
    id: string;
    email: string;
    password: string;
    name?: string;
    created_at: string;
    updated_at: string;
}

export interface DbAgent {
    id: string;
    user_id: string;
    name: string;
    website_url?: string;
    face_id?: string;
    voice_id?: string;
    status: string;
    embed_code?: string;
    created_at: string;
    updated_at: string;
}

export interface DbKnowledgeBase {
    id: string;
    agent_id: string;
    source_url?: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface DbDocumentChunk {
    id: string;
    kb_id: string;
    content: string;
    source?: string;
    chunk_index: number;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface DbSession {
    id: string;
    agent_id: string;
    status: string;
    started_at: string;
    ended_at?: string;
}

export interface DbMessage {
    id: string;
    session_id: string;
    role: 'user' | 'agent';
    content: string;
    created_at: string;
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
    return !!(supabaseUrl && supabaseAnonKey);
}

// Test connection
export async function testConnection(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
        const { error } = await supabase.from('users').select('id').limit(1);
        return !error;
    } catch {
        return false;
    }
}

export default supabase;
