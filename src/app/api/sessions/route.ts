import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getUserByEmail } from '@/lib/db';

// GET /api/sessions - Fetch all sessions for the current user's agents
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (userError || !user) {
            // Return empty sessions for new users
            return NextResponse.json([]);
        }

        // Get all agents for this user
        const { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('id')
            .eq('user_id', user.id);

        if (agentsError) {
            console.error('Error fetching agents:', agentsError);
            return NextResponse.json([]);
        }

        if (!agents || agents.length === 0) {
            return NextResponse.json([]);
        }

        const agentIds = agents.map((a: { id: string }) => a.id);

        // Get all sessions for these agents (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .in('agent_id', agentIds)
            .gte('started_at', thirtyDaysAgo.toISOString())
            .order('started_at', { ascending: false });

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            return NextResponse.json([]);
        }

        return NextResponse.json(sessions || []);
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
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('user_id')
            .eq('id', agent_id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const user = await getUserByEmail(session.user.email);
        if (!user || agent.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this agent' }, { status: 403 });
        }

        const { data: newSession, error } = await supabase
            .from('sessions')
            .insert({
                agent_id,
                status: 'active',
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating session:', error);
            return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
        }

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

        const { data: updatedSession, error } = await supabase
            .from('sessions')
            .update({
                status: 'ended',
                ended_at: new Date().toISOString(),
            })
            .eq('id', session_id)
            .select()
            .single();

        if (error) {
            console.error('Error ending session:', error);
            return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
        }

        return NextResponse.json(updatedSession);
    } catch (error) {
        console.error('Error in PATCH /api/sessions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
