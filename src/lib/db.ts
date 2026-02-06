// Database Layer - Firebase Firestore Integration
// Migrated from Supabase to Firestore

import { User, Agent, KnowledgeBase, DocumentChunk } from './types';
import { db, firestoreHelpers, Timestamp, where, orderBy } from './firestore';

// ============ USER OPERATIONS ============

export async function createUser(user: User): Promise<User> {
    try {
        await firestoreHelpers.setDocument('users', user.id, {
            email: user.email,
            password: user.password,
            createdAt: Timestamp.fromDate(user.createdAt),
            updatedAt: Timestamp.now(),
        });
        return user;
    } catch (error) {
        console.error('Firestore createUser error:', error);
        throw error;
    }
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
    try {
        const users = await firestoreHelpers.queryDocuments<any>(
            'users',
            [{ field: 'email', operator: '==', value: email }],
            undefined,
            1
        );

        if (users.length > 0) {
            const data = users[0];
            return {
                id: data.id,
                email: data.email,
                password: data.password,
                createdAt: data.createdAt.toDate(),
            };
        }

        return undefined;
    } catch (error) {
        console.error('Firestore getUserByEmail error:', error);
        return undefined;
    }
}

export async function getUserById(id: string): Promise<User | undefined> {
    try {
        const data = await firestoreHelpers.getDocument<any>('users', id);

        if (data) {
            return {
                id: id,
                email: data.email,
                password: data.password,
                createdAt: data.createdAt.toDate(),
            };
        }

        return undefined;
    } catch (error) {
        console.error('Firestore getUserById error:', error);
        return undefined;
    }
}

// ============ AGENT OPERATIONS ============

export async function createAgent(agent: Agent): Promise<Agent> {
    try {
        // Create agent under user's subcollection
        const agentPath = `users/${agent.userId}/agents/${agent.id}`;
        await firestoreHelpers.setDocument('agents', agent.id, {
            userId: agent.userId,
            name: agent.name,
            websiteUrl: agent.websiteUrl,
            faceId: agent.faceId,
            voiceId: agent.voiceId,
            status: agent.status,
            embedCode: agent.embedCode,
            createdAt: Timestamp.fromDate(agent.createdAt),
            updatedAt: Timestamp.now(),
        });

        return agent;
    } catch (error) {
        console.error('Firestore createAgent error:', error);
        throw error;
    }
}

export async function getAgentsByUserId(userId: string): Promise<Agent[]> {
    try {
        const agents = await firestoreHelpers.queryDocuments<any>(
            'agents',
            [{ field: 'userId', operator: '==', value: userId }]
        );

        return agents.map(a => ({
            id: a.id,
            userId: a.userId,
            name: a.name,
            websiteUrl: a.websiteUrl,
            faceId: a.faceId,
            voiceId: a.voiceId,
            status: a.status as 'active' | 'inactive' | 'training',
            embedCode: a.embedCode,
            createdAt: a.createdAt.toDate(),
        }));
    } catch (error) {
        console.error('Firestore getAgentsByUserId error:', error);
        return [];
    }
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
    try {
        const data = await firestoreHelpers.getDocument<any>('agents', id);

        if (data) {
            return {
                id: id,
                userId: data.userId,
                name: data.name,
                websiteUrl: data.websiteUrl,
                faceId: data.faceId,
                voiceId: data.voiceId,
                status: data.status as 'active' | 'inactive' | 'training',
                embedCode: data.embedCode,
                createdAt: data.createdAt.toDate(),
            };
        }

        return undefined;
    } catch (error) {
        console.error('Firestore getAgentById error:', error);
        return undefined;
    }
}

export async function updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    try {
        const updateData: Record<string, any> = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.websiteUrl) updateData.websiteUrl = updates.websiteUrl;
        if (updates.faceId) updateData.faceId = updates.faceId;
        if (updates.voiceId) updateData.voiceId = updates.voiceId;
        if (updates.status) updateData.status = updates.status;
        if (updates.embedCode) updateData.embedCode = updates.embedCode;

        await firestoreHelpers.updateDocument('agents', id, updateData);
        return await getAgentById(id);
    } catch (error) {
        console.error('Firestore updateAgent error:', error);
        return undefined;
    }
}

export async function deleteAgent(id: string): Promise<boolean> {
    try {
        await firestoreHelpers.deleteDocument('agents', id);
        return true;
    } catch (error) {
        console.error('Firestore deleteAgent error:', error);
        return false;
    }
}

// ============ KNOWLEDGE BASE OPERATIONS ============

export async function createKnowledgeBase(kb: KnowledgeBase): Promise<KnowledgeBase> {
    try {
        // Create knowledge base
        await firestoreHelpers.setDocument('knowledgeBases', kb.id, {
            agentId: kb.agentId,
            sourceUrl: kb.sourceUrl,
            status: kb.status,
            createdAt: Timestamp.fromDate(kb.createdAt),
            updatedAt: Timestamp.now(),
        });

        // Create document chunks in subcollection
        for (let i = 0; i < kb.chunks.length; i++) {
            const chunk = kb.chunks[i];
            const chunkPath = `${kb.id}/chunks/${chunk.id}`;
            await firestoreHelpers.setDocument(`knowledgeBases/${chunkPath}`, chunk.id, {
                content: chunk.content,
                source: chunk.source,
                chunkIndex: i,
                metadata: chunk.metadata || {},
                createdAt: Timestamp.now(),
            });
        }

        return kb;
    } catch (error) {
        console.error('Firestore createKnowledgeBase error:', error);
        throw error;
    }
}

export async function getKnowledgeBaseByAgentId(agentId: string): Promise<KnowledgeBase | undefined> {
    try {
        const kbList = await firestoreHelpers.queryDocuments<any>(
            'knowledgeBases',
            [{ field: 'agentId', operator: '==', value: agentId }],
            undefined,
            1
        );

        if (kbList.length === 0) return undefined;

        const kbData = kbList[0];

        // Get chunks from subcollection
        const chunks = await firestoreHelpers.getCollection<any>(
            `knowledgeBases/${kbData.id}/chunks`,
            [orderBy('chunkIndex')]
        );

        return {
            id: kbData.id,
            agentId: kbData.agentId,
            sourceUrl: kbData.sourceUrl,
            status: kbData.status as 'processing' | 'ready' | 'error',
            chunks: chunks.map(c => ({
                id: c.id,
                content: c.content,
                source: c.source,
                metadata: c.metadata || {},
            })),
            createdAt: kbData.createdAt.toDate(),
        };
    } catch (error) {
        console.error('Firestore getKnowledgeBaseByAgentId error:', error);
        return undefined;
    }
}

export async function updateKnowledgeBase(id: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    try {
        const updateData: Record<string, any> = {};
        if (updates.sourceUrl) updateData.sourceUrl = updates.sourceUrl;
        if (updates.status) updateData.status = updates.status;

        await firestoreHelpers.updateDocument('knowledgeBases', id, updateData);

        // Get and return updated KB
        const kbData = await firestoreHelpers.getDocument<any>('knowledgeBases', id);
        if (!kbData) return undefined;

        return await getKnowledgeBaseByAgentId(kbData.agentId);
    } catch (error) {
        console.error('Firestore updateKnowledgeBase error:', error);
        return undefined;
    }
}

// ============ SEARCH OPERATIONS ============

export async function searchKnowledgeBase(agentId: string, query: string): Promise<DocumentChunk[]> {
    const kb = await getKnowledgeBaseByAgentId(agentId);
    if (!kb) return [];

    // Simple keyword matching (for production, use vector embeddings via Vertex AI)
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
    try {
        const voices = await firestoreHelpers.getCollection<any>('voices', [orderBy('name')]);

        if (voices.length > 0) {
            return voices.map(v => ({
                id: v.id,
                name: v.name,
                gender: v.gender,
                style: v.style,
                previewUrl: v.previewUrl,
                isCustom: v.isCustom,
            }));
        }
    } catch (error) {
        console.error('Firestore getVoices error:', error);
    }

    // Fallback to default voices
    return DEFAULT_VOICES;
}

export async function getVoiceById(id: string): Promise<Voice | undefined> {
    try {
        const data = await firestoreHelpers.getDocument<any>('voices', id);

        if (data) {
            return {
                id: id,
                name: data.name,
                gender: data.gender,
                style: data.style,
                previewUrl: data.previewUrl,
                isCustom: data.isCustom,
            };
        }
    } catch (error) {
        console.error('Firestore getVoiceById error:', error);
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
        console.log('✅ Demo user created in Firestore');
    }
}

// Auto-initialize on module load
initializeDemoData().catch(console.error);
