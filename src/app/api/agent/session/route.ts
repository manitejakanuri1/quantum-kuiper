import { NextResponse } from 'next/server';
import { startSession, handleUserInput, getSessionState, generateGreeting } from '@/lib/conversation';
import { getAgentById } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sessionActionSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Force dynamic rendering - don't evaluate at build time
export const dynamic = 'force-dynamic';


export async function POST(request: Request) {
    try {
        // SECURITY FIX: Add authentication check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // SECURITY FIX: Validate input with Zod schema
        const body = await request.json();
        const validatedData = sessionActionSchema.parse(body);
        const { action, agentId, sessionId, userText } = validatedData;

        switch (action) {
            case 'start': {
                const agent = await getAgentById(agentId);
                if (!agent) {
                    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
                }

                // SECURITY FIX: Verify agent ownership
                if (agent.userId !== session.user.id) {
                    return NextResponse.json(
                        { error: 'Agent not found' },
                        { status: 404 }
                    );
                }

                const state = await startSession(agentId);
                if (!state) {
                    logger.error('Failed to start session', { agentId, userId: session.user.id });
                    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
                }

                const greeting = await generateGreeting(agentId);

                logger.info('Session started', { sessionId: state.session.id, agentId });

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
        // SECURITY FIX: Don't expose error details, use logger instead of console
        if (error instanceof z.ZodError) {
            logger.warn('Validation failed in session API', { errors: error.issues });
            return NextResponse.json(
                { error: 'Invalid input', details: error.issues },
                { status: 400 }
            );
        }

        logger.error('Session API error', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
