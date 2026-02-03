import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentById, deleteAgent, updateAgent } from '@/lib/db';
import { updateAgentSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// GET - Fetch single agent
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agent = await getAgentById(id);
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        return NextResponse.json(agent);
    } catch (error) {
        logger.error('Error fetching agent', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update agent
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agent = await getAgentById(id);
        if (!agent || agent.userId !== session.user.id) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // SECURITY FIX: Validate input with Zod schema
        const body = await request.json();
        const validatedData = updateAgentSchema.parse(body);

        logger.info('Updating agent', {
            agentId: id,
            userId: session.user.id,
            fields: Object.keys(validatedData)
        });

        const updatedAgent = await updateAgent(id, validatedData);

        return NextResponse.json(updatedAgent);
    } catch (error) {
        // SECURITY FIX: Proper error handling with validation awareness
        if (error instanceof z.ZodError) {
            logger.warn('Validation failed in update agent API', { errors: error.issues });
            return NextResponse.json(
                { error: 'Invalid input', details: error.issues },
                { status: 400 }
            );
        }

        logger.error('Error updating agent', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Remove agent
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agent = await getAgentById(id);
        if (!agent || agent.userId !== session.user.id) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        await deleteAgent(id);

        logger.info('Agent deleted', { agentId: id, userId: session.user.id });
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting agent', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

