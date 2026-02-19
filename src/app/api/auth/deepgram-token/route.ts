// Deepgram Temporary Token API
// POST /api/auth/deepgram-token
// Generates a short-lived JWT for client-side Deepgram WebSocket connections.
// The real API key never leaves the server.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimitResult = await rateLimit(
    `deepgram-token:${getClientIdentifier(request)}`,
    { max: 10, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    // Generate a temporary token via Deepgram's auth/grant endpoint
    // TTL: 300 seconds (5 minutes) — enough for one conversation session
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Deepgram Token] Error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: 'Failed to generate Deepgram token' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Deepgram returns: { member_id, key_id, api_key_id, access_token, ... }
    // We only return the access_token to the client
    return NextResponse.json({
      token: data.access_token,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('[Deepgram Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
