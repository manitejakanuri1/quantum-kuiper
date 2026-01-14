// Database Layer - Supabase Integration
// Auto-connects to Supabase, falls back to in-memory if not configured

import { User, Agent, KnowledgeBase, DocumentChunk } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

// In-memory fallback storage
const usersMemory: Map<string, User> = new Map();
const agentsMemory: Map<string, Agent> = new Map();
const knowledgeBasesMemory: Map<string, KnowledgeBase> = new Map();

// ============ USER OPERATIONS ============

export async function createUser(user: User): Promise<User> {
    if (isSupabaseConfigured()) {
        const { error } = await supabase
            .from('users')
            .insert({
                id: user.id,
                email: user.email,
                password: user.password,
                created_at: user.createdAt.toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase createUser error:', error);
            // Fall back to memory
            usersMemory.set(user.id, user);
        }
        return user;
    }

    usersMemory.set(user.id, user);
    return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (data && !error) {
            return {
                id: data.id,
                email: data.email,
                password: data.password,
                createdAt: new Date(data.created_at)
            };
        }
    }

    return Array.from(usersMemory.values()).find(u => u.email === email);
}

export async function getUserById(id: string): Promise<User | undefined> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (data && !error) {
            return {
                id: data.id,
                email: data.email,
                password: data.password,
                createdAt: new Date(data.created_at)
            };
        }
    }

    return usersMemory.get(id);
}

// ============ AGENT OPERATIONS ============

export async function createAgent(agent: Agent): Promise<Agent> {
    if (isSupabaseConfigured()) {
        const { error } = await supabase
            .from('agents')
            .insert({
                id: agent.id,
                user_id: agent.userId,
                name: agent.name,
                website_url: agent.websiteUrl,
                face_id: agent.faceId,
                voice_id: agent.voiceId,
                status: agent.status,
                embed_code: agent.embedCode,
                created_at: agent.createdAt.toISOString()
            });

        if (error) {
            console.error('Supabase createAgent error:', error);
            agentsMemory.set(agent.id, agent);
        }
        return agent;
    }

    agentsMemory.set(agent.id, agent);
    return agent;
}

export async function getAgentsByUserId(userId: string): Promise<Agent[]> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .eq('user_id', userId);

        if (data && !error) {
            return data.map(a => ({
                id: a.id,
                userId: a.user_id,
                name: a.name,
                websiteUrl: a.website_url,
                faceId: a.face_id,
                voiceId: a.voice_id,
                status: a.status as 'active' | 'inactive' | 'training',
                embedCode: a.embed_code,
                createdAt: new Date(a.created_at)
            }));
        }
    }

    return Array.from(agentsMemory.values()).filter(a => a.userId === userId);
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .eq('id', id)
            .single();

        if (data && !error) {
            return {
                id: data.id,
                userId: data.user_id,
                name: data.name,
                websiteUrl: data.website_url,
                faceId: data.face_id,
                voiceId: data.voice_id,
                status: data.status as 'active' | 'inactive' | 'training',
                embedCode: data.embed_code,
                createdAt: new Date(data.created_at)
            };
        }
    }

    return agentsMemory.get(id);
}

export async function updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    if (isSupabaseConfigured()) {
        const updateData: Record<string, string | undefined> = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.websiteUrl) updateData.website_url = updates.websiteUrl;
        if (updates.faceId) updateData.face_id = updates.faceId;
        if (updates.voiceId) updateData.voice_id = updates.voiceId;
        if (updates.status) updateData.status = updates.status;
        if (updates.embedCode) updateData.embed_code = updates.embedCode;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('agents')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (data && !error) {
            return {
                id: data.id,
                userId: data.user_id,
                name: data.name,
                websiteUrl: data.website_url,
                faceId: data.face_id,
                voiceId: data.voice_id,
                status: data.status as 'active' | 'inactive' | 'training',
                embedCode: data.embed_code,
                createdAt: new Date(data.created_at)
            };
        }
    }

    const agent = agentsMemory.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates };
    agentsMemory.set(id, updated);
    return updated;
}

export async function deleteAgent(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('id', id);

        return !error;
    }

    return agentsMemory.delete(id);
}

// ============ KNOWLEDGE BASE OPERATIONS ============

export async function createKnowledgeBase(kb: KnowledgeBase): Promise<KnowledgeBase> {
    if (isSupabaseConfigured()) {
        // Insert knowledge base
        const { error: kbError } = await supabase
            .from('knowledge_bases')
            .insert({
                id: kb.id,
                agent_id: kb.agentId,
                source_url: kb.sourceUrl,
                status: kb.status,
                created_at: kb.createdAt.toISOString()
            });

        if (kbError) {
            console.error('Supabase createKnowledgeBase error:', kbError);
        }

        // Insert document chunks
        if (kb.chunks.length > 0) {
            const chunks = kb.chunks.map((chunk, index) => ({
                id: chunk.id,
                kb_id: kb.id,
                content: chunk.content,
                source: chunk.source,
                chunk_index: index,
                metadata: chunk.metadata
            }));

            const { error: chunksError } = await supabase
                .from('document_chunks')
                .insert(chunks);

            if (chunksError) {
                console.error('Supabase insertChunks error:', chunksError);
            }
        }

        return kb;
    }

    knowledgeBasesMemory.set(kb.id, kb);
    return kb;
}

export async function getKnowledgeBaseByAgentId(agentId: string): Promise<KnowledgeBase | undefined> {
    if (isSupabaseConfigured()) {
        const { data: kbData, error: kbError } = await supabase
            .from('knowledge_bases')
            .select('*')
            .eq('agent_id', agentId)
            .single();

        if (kbData && !kbError) {
            // Get chunks
            const { data: chunksData } = await supabase
                .from('document_chunks')
                .select('*')
                .eq('kb_id', kbData.id)
                .order('chunk_index');

            const chunks: DocumentChunk[] = (chunksData || []).map(c => ({
                id: c.id,
                content: c.content,
                source: c.source,
                metadata: c.metadata
            }));

            return {
                id: kbData.id,
                agentId: kbData.agent_id,
                sourceUrl: kbData.source_url,
                status: kbData.status as 'processing' | 'ready' | 'error',
                chunks,
                createdAt: new Date(kbData.created_at)
            };
        }
    }

    return Array.from(knowledgeBasesMemory.values()).find(kb => kb.agentId === agentId);
}

export async function updateKnowledgeBase(id: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    if (isSupabaseConfigured()) {
        const updateData: Record<string, string | undefined> = {};
        if (updates.sourceUrl) updateData.source_url = updates.sourceUrl;
        if (updates.status) updateData.status = updates.status;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('knowledge_bases')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (data && !error) {
            return await getKnowledgeBaseByAgentId(data.agent_id);
        }
    }

    const kb = knowledgeBasesMemory.get(id);
    if (!kb) return undefined;
    const updated = { ...kb, ...updates };
    knowledgeBasesMemory.set(id, updated);
    return updated;
}

// ============ SEARCH OPERATIONS ============

export async function searchKnowledgeBase(agentId: string, query: string): Promise<DocumentChunk[]> {
    const kb = await getKnowledgeBaseByAgentId(agentId);
    if (!kb) return [];

    // Simple keyword matching (for production, use vector embeddings)
    const queryWords = query.toLowerCase().split(/\s+/);
    return kb.chunks
        .filter(chunk => {
            const chunkWords = chunk.content.toLowerCase();
            return queryWords.some(word => chunkWords.includes(word));
        })
        .slice(0, 3);
}

// ============ VOICE OPERATIONS ============

export interface Voice {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    style: string;
    previewUrl?: string;
    isCustom: boolean;
}

// Default voices if database is unavailable
const DEFAULT_VOICES: Voice[] = [
    { id: '8ef4a238714b45718ce04243307c57a7', name: 'E Girl', gender: 'female', style: 'playful', isCustom: false },
    { id: 'default-female', name: 'Professional Female', gender: 'female', style: 'professional', isCustom: false },
    { id: 'default-male', name: 'Friendly Male', gender: 'male', style: 'friendly', isCustom: false },
    { id: 'warm-female', name: 'Warm Female', gender: 'female', style: 'warm', isCustom: false },
    { id: 'confident-male', name: 'Confident Male', gender: 'male', style: 'confident', isCustom: false },
];

export async function getVoices(): Promise<Voice[]> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
            .from('voices')
            .select('*')
            .order('name');

        if (data && !error) {
            return data.map(v => ({
                id: v.id,
                name: v.name,
                gender: v.gender,
                style: v.style,
                previewUrl: v.preview_url,
                isCustom: v.is_custom
            }));
        }
        console.error('Supabase getVoices error:', error);
    }

    // Fallback to default voices
    return DEFAULT_VOICES;
}

export async function getVoiceById(id: string): Promise<Voice | undefined> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
            .from('voices')
            .select('*')
            .eq('id', id)
            .single();

        if (data && !error) {
            return {
                id: data.id,
                name: data.name,
                gender: data.gender,
                style: data.style,
                previewUrl: data.preview_url,
                isCustom: data.is_custom
            };
        }
    }

    return DEFAULT_VOICES.find(v => v.id === id);
}

// ============ INITIALIZATION ============

export async function initializeDemoData(): Promise<void> {
    const existingUser = await getUserByEmail('demo@example.com');
    if (!existingUser) {
        await createUser({
            id: 'demo-user-1',
            email: 'demo@example.com',
            password: '$2b$10$demo-hashed-password',
            createdAt: new Date()
        });
        console.log('✅ Demo user created');
    }
}

// Auto-initialize on module load
initializeDemoData().catch(console.error);

