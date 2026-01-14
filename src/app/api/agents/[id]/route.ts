import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentById, deleteAgent, updateAgent } from '@/lib/db';

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
        console.error('Error fetching agent:', error);
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
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const body = await request.json();
        const { name, websiteUrl, faceId, voiceId } = body;

        const updatedAgent = await updateAgent(id, {
            name: name || agent.name,
            websiteUrl: websiteUrl || agent.websiteUrl,
            faceId: faceId || agent.faceId,
            voiceId: voiceId || agent.voiceId,
        });

        return NextResponse.json(updatedAgent);
    } catch (error) {
        console.error('Error updating agent:', error);
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

