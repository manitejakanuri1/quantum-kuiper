import { NextResponse } from 'next/server';
import { startSession, handleUserInput, getSessionState, generateGreeting } from '@/lib/conversation';
import { getAgentById } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, agentId, sessionId, userText } = body;

        switch (action) {
            case 'start': {
                const agent = await getAgentById(agentId);
                if (!agent) {
                    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
                }

                const state = await startSession(agentId);
                if (!state) {
                    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
                }

                const greeting = await generateGreeting(agentId);

                return NextResponse.json({
                    sessionId: state.session.id,
                    greeting
                });
            }

            case 'message': {
                if (!sessionId || !userText) {
                    return NextResponse.json({ error: 'Missing sessionId or userText' }, { status: 400 });
                }

                const response = await handleUserInput(sessionId, userText);
                if (!response) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                return NextResponse.json(response);
            }

            case 'status': {
                if (!sessionId) {
                    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
                }

                const state = getSessionState(sessionId);
                if (!state) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                return NextResponse.json({
                    isAgentSpeaking: state.isAgentSpeaking,
                    messageCount: state.messages.length
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Session API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
