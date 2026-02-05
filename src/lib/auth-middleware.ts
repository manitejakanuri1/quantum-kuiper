// Authentication Middleware for API Routes
// Validates sessions and enforces authorization

import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';

export interface AuthenticatedRequest extends NextRequest {
    userId?: string;
    user?: {
        id: string;
        email: string;
    };
}

/**
 * Middleware to require authentication on API routes
 * Usage: const session = await requireAuth(request);
 */
export async function requireAuth(request: NextRequest): Promise<{
    userId: string;
    email: string;
} | null> {
    try {
        const session = await auth();

        if (!session || !session.user?.id) {
            return null;
        }

        return {
            userId: session.user.id,
            email: session.user.email || '',
        };
    } catch (error) {
        console.error('Auth middleware error:', error);
        return null;
    }
}

/**
 * Wrapper function for protected API routes
 * Automatically returns 401 if not authenticated
 */
export function withAuth(
    handler: (req: NextRequest, user: { userId: string; email: string }) => Promise<NextResponse>
) {
    return async (req: NextRequest) => {
        const user = await requireAuth(req);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Authentication required' },
                { status: 401 }
            );
        }

        return handler(req, user);
    };
}

/**
 * Check if user owns a specific agent
 */
export async function requireAgentOwnership(
    userId: string,
    agentId: string
): Promise<boolean> {
    try {
        const { getAgentById } = await import('./db');
        const agent = await getAgentById(agentId);

        return agent?.userId === userId;
    } catch (error) {
        console.error('Agent ownership check error:', error);
        return false;
    }
}

/**
 * Middleware to require agent ownership
 * Use in routes that modify agent data
 */
export async function requireOwnership(
    request: NextRequest,
    agentId: string
): Promise<{ userId: string; email: string } | null> {
    const user = await requireAuth(request);

    if (!user) {
        return null;
    }

    const ownsAgent = await requireAgentOwnership(user.userId, agentId);

    if (!ownsAgent) {
        return null;
    }

    return user;
}

/**
 * Validate API key for external/webhook requests
 * Add X-API-Key header support
 */
export async function validateApiKey(request: NextRequest): Promise<boolean> {
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
        return false;
    }

    // In production, validate against stored API keys in database
    // For now, check against environment variable
    const validKey = process.env.API_SECRET_KEY;

    return apiKey === validKey;
}

/**
 * Rate limit helper (Simple in-memory implementation)
 * For production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
    identifier: string,
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = rateLimitMap.get(identifier);

    // Clean up expired entries periodically
    if (rateLimitMap.size > 10000) {
        for (const [key, value] of rateLimitMap.entries()) {
            if (value.resetAt < now) {
                rateLimitMap.delete(key);
            }
        }
    }

    if (!record || record.resetAt < now) {
        // New window
        const resetAt = now + windowMs;
        rateLimitMap.set(identifier, { count: 1, resetAt });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    if (record.count >= maxRequests) {
        // Rate limit exceeded
        return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    // Increment counter
    record.count++;
    rateLimitMap.set(identifier, record);
    return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

/**
 * Get rate limit identifier from request
 * Uses user ID if authenticated, otherwise IP address
 */
export function getRateLimitIdentifier(request: NextRequest, userId?: string): string {
    if (userId) {
        return `user:${userId}`;
    }

    // Get IP from various headers (reverse proxy support)
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown';

    return `ip:${ip}`;
}
