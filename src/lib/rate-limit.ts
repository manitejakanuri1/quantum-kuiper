// Rate Limiting Middleware for API Routes
// Prevents brute force attacks and API abuse

import { NextResponse } from 'next/server';

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach(key => {
        if (store[key].resetTime < now) {
            delete store[key];
        }
    });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    windowMs?: number;  // Time window in milliseconds (default: 15 minutes)
    max?: number;       // Max requests per window (default: 100)
}

/**
 * Rate limit middleware for API routes
 *
 * @param identifier - Unique identifier (IP, user ID, email, etc.)
 * @param config - Rate limit configuration
 * @returns null if allowed, NextResponse with 429 if rate limited
 *
 * @example
 * const rateLimitResult = rateLimit(request.ip, { max: 5, windowMs: 60000 });
 * if (rateLimitResult) return rateLimitResult;
 */
export function rateLimit(
    identifier: string,
    config: RateLimitConfig = {}
): NextResponse | null {
    const windowMs = config.windowMs || 15 * 60 * 1000; // 15 minutes default
    const max = config.max || 100; // 100 requests default

    const now = Date.now();
    const key = `ratelimit:${identifier}`;

    // Initialize or get existing entry
    if (!store[key] || store[key].resetTime < now) {
        store[key] = {
            count: 1,
            resetTime: now + windowMs
        };
        return null;
    }

    // Increment counter
    store[key].count++;

    // Check if limit exceeded
    if (store[key].count > max) {
        const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
        return NextResponse.json(
            {
                error: 'Too many requests',
                message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
                retryAfter
            },
            {
                status: 429,
                headers: {
                    'Retry-After': retryAfter.toString(),
                    'X-RateLimit-Limit': max.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': new Date(store[key].resetTime).toISOString()
                }
            }
        );
    }

    return null;
}

/**
 * Get client identifier from request (IP address or fallback)
 */
export function getClientIdentifier(request: Request): string {
    // Try to get real IP from headers (works with proxies/load balancers)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    if (realIp) {
        return realIp;
    }

    // Fallback to a generic identifier
    return 'unknown';
}
