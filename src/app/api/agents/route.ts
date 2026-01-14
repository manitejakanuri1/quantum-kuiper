import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentsByUserId } from '@/lib/db';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agents = await getAgentsByUserId(session.user.id);

        return NextResponse.json({ agents });
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
