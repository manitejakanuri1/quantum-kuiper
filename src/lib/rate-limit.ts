// Rate Limiting — Upstash Redis (persistent across serverless invocations)
// Falls back to in-memory if Redis unavailable (fail-open, never blocks users)

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ─── Redis Client (singleton, graceful fallback) ───

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ─── In-memory fallback (for local dev / Redis unavailable) ───

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const memoryStore: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(memoryStore).forEach(key => {
    if (memoryStore[key].resetTime < now) {
      delete memoryStore[key];
    }
  });
}, 5 * 60 * 1000);

function memoryRateLimit(key: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  if (!memoryStore[key] || memoryStore[key].resetTime < now) {
    memoryStore[key] = { count: 1, resetTime: now + windowMs };
    return null;
  }
  memoryStore[key].count++;
  if (memoryStore[key].count > max) {
    const retryAfter = Math.ceil((memoryStore[key].resetTime - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': max.toString(),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  return null;
}

// ─── Config ───

export interface RateLimitConfig {
  windowMs?: number;  // Time window in milliseconds (default: 15 minutes)
  max?: number;       // Max requests per window (default: 100)
}

// ─── Main rate limit function ───

/**
 * Rate limit using Upstash Redis (persistent across cold starts).
 * Falls back to in-memory if Redis is unavailable.
 *
 * @param identifier - Unique identifier (IP, user ID, email, etc.)
 * @param config - Rate limit configuration
 * @returns null if allowed, NextResponse with 429 if rate limited
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): Promise<NextResponse | null> {
  const windowMs = config.windowMs || 15 * 60 * 1000;
  const max = config.max || 100;
  const windowSec = Math.ceil(windowMs / 1000);
  const key = `rl:${identifier}`;

  const r = getRedis();
  if (!r) {
    // No Redis — use in-memory fallback
    return memoryRateLimit(key, max, windowMs);
  }

  try {
    const count = await r.incr(key);
    if (count === 1) {
      await r.expire(key, windowSec);
    }

    if (count > max) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': windowSec.toString(),
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    return null;
  } catch {
    // Redis error — fail open with in-memory fallback
    return memoryRateLimit(key, max, windowMs);
  }
}

/**
 * Get client identifier from request (IP address or fallback).
 *
 * SECURITY NOTE: x-forwarded-for and x-real-ip headers can be spoofed by
 * clients when not behind a trusted reverse proxy. On Vercel, these headers
 * are reliable because Vercel overwrites them at the edge. On other platforms,
 * ensure your load balancer/proxy strips client-provided forwarding headers.
 * If running without a trusted proxy, this falls back to 'unknown' which
 * means all requests share a single rate limit bucket (safe but not ideal).
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (reliable behind Vercel / trusted proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback — all unidentified requests share one bucket
  return 'unknown';
}
