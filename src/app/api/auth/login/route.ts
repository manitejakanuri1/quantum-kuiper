import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';

/**
 * Login rate limiting endpoint
 * Prevents brute force attacks on authentication
 */
export async function POST(request: NextRequest) {
    // Apply strict rate limiting for login attempts
    // 5 attempts per 15 minutes per IP
    const clientId = getClientIdentifier(request);
    const rateLimitResult = rateLimit(clientId, {
        max: 5,
        windowMs: 15 * 60 * 1000 // 15 minutes
    });

    if (rateLimitResult) {
        return rateLimitResult;
    }

    // Continue with normal authentication
    return NextResponse.json({ success: true });
}
