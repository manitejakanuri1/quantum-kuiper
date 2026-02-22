// Simli Session Token API
// POST /api/auth/simli-token
// Generates a session token for client-side Simli WebRTC connections.
// The real API key never leaves the server.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { requireJsonContentType } from '@/lib/request-validation';

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimitResult = await rateLimit(
    `simli-token:${getClientIdentifier(request)}`,
    { max: 3, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  const contentTypeError = requireJsonContentType(request);
  if (contentTypeError) return contentTypeError;

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

    // Get a session token from Simli via startAudioToVideoSession
    // (the old /getSessionToken endpoint was deprecated in SDK v2)
    const response = await fetch('https://api.simli.ai/startAudioToVideoSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: SIMLI_API_KEY,
        faceId,
        isJPG: false,
        syncAudio: true,
        handleSilence: true,
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
    // v2 API returns { session_token } (underscore, not camelCase)
    return NextResponse.json({
      sessionToken: data.session_token,
    });
  } catch (error) {
    console.error('[Simli Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
