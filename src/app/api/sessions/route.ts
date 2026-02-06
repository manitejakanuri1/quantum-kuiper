import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserByEmail, getAgentsByUserId, getAgentById } from '@/lib/db';
import { firestoreHelpers, Timestamp } from '@/lib/firestore';
import { v4 as uuidv4 } from 'uuid';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface Session {
    id: string;
    agent_id: string;
    status: string;
    started_at: string;
    ended_at?: string;
}

// GET /api/sessions - Fetch all sessions for the current user's agents
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database
        const user = await getUserByEmail(session.user.email);
        if (!user) {
            return NextResponse.json([]);
        }

        // Get all agents for this user
        const agents = await getAgentsByUserId(user.id);
        if (!agents || agents.length === 0) {
            return NextResponse.json([]);
        }

        const agentIds = agents.map(a => a.id);

        // Get all sessions for these agents (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Query sessions from Firestore
        const allSessions: Session[] = [];
        for (const agentId of agentIds) {
            const sessions = await firestoreHelpers.queryDocuments<any>(
                'sessions',
                [
                    { field: 'agent_id', operator: '==', value: agentId },
                    { field: 'started_at', operator: '>=', value: Timestamp.fromDate(thirtyDaysAgo) }
                ]
            );
            allSessions.push(...sessions.map(s => ({
                id: s.id,
                agent_id: s.agent_id,
                status: s.status,
                started_at: s.started_at?.toDate?.()?.toISOString() || s.started_at,
                ended_at: s.ended_at?.toDate?.()?.toISOString() || s.ended_at,
            })));
        }

        // Sort by started_at descending
        allSessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

        return NextResponse.json(allSessions);
    } catch (error) {
        console.error('Error in GET /api/sessions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { agent_id } = body;

        if (!agent_id) {
            return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
        }

        // SECURITY: Verify user owns the agent before creating session
        const agent = await getAgentById(agent_id);
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const user = await getUserByEmail(session.user.email);
        if (!user || agent.userId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this agent' }, { status: 403 });
        }

        const newSessionId = uuidv4();
        const now = new Date();

        await firestoreHelpers.setDocument('sessions', newSessionId, {
            agent_id,
            status: 'active',
            started_at: Timestamp.fromDate(now),
        });

        const newSession = {
            id: newSessionId,
            agent_id,
            status: 'active',
            started_at: now.toISOString(),
        };

        return NextResponse.json(newSession);
    } catch (error) {
        console.error('Error in POST /api/sessions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/sessions - End a session
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { session_id } = body;

        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        const now = new Date();

        await firestoreHelpers.updateDocument('sessions', session_id, {
            status: 'ended',
            ended_at: Timestamp.fromDate(now),
        });

        const updatedSession = await firestoreHelpers.getDocument<any>('sessions', session_id);

        return NextResponse.json({
            id: session_id,
            ...updatedSession,
            started_at: updatedSession?.started_at?.toDate?.()?.toISOString() || updatedSession?.started_at,
            ended_at: now.toISOString(),
        });
    } catch (error) {
        console.error('Error in PATCH /api/sessions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
