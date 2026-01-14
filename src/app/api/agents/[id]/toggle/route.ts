import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentById, updateAgent } from '@/lib/db';

export async function POST(
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

        const newStatus = agent.status === 'active' ? 'inactive' : 'active';
        await updateAgent(id, { status: newStatus });

        return NextResponse.json({ success: true, status: newStatus });
    } catch (error) {
        console.error('Error toggling agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
