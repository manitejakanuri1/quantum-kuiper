// Simli Session Token API
// POST /api/auth/simli-token
// Generates a session token for client-side Simli WebRTC connections.
// The real API key never leaves the server.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimitResult = await rateLimit(
    `simli-token:${getClientIdentifier(request)}`,
    { max: 10, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    if (!SIMLI_API_KEY) {
      return NextResponse.json(
        { error: 'Simli API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { faceId } = body as { faceId: string };

    if (!faceId || typeof faceId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(faceId)) {
      return NextResponse.json(
        { error: 'Invalid face ID' },
        { status: 400 }
      );
    }

    // Get a session token from Simli
    const response = await fetch('https://api.simli.ai/getSessionToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: SIMLI_API_KEY,
        faceId,
        maxSessionLength: 600,
        maxIdleTime: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Simli Token] Error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: 'Failed to generate Simli session token' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Return only the session token — not the API key
    return NextResponse.json({
      sessionToken: data.sessionToken,
    });
  } catch (error) {
    console.error('[Simli Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
