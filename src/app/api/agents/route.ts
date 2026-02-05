import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getAgentsByUserId } from '@/lib/db';
import { getSecurityHeaders } from '@/lib/security-utils';

export const GET = withAuth(async (request: NextRequest, user) => {
    try {
        const agents = await getAgentsByUserId(user.userId);

        return NextResponse.json(
            { agents },
            { headers: getSecurityHeaders() }
        );
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: getSecurityHeaders() }
        );
    }
});
