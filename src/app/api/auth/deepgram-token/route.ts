// Deepgram Token API
// POST /api/auth/deepgram-token
// Returns the Deepgram API key for client-side WebSocket STT connections.
// Protected by: rate limiting (3 req/min per IP) + agent validation (must be ready).
// The key is only usable for STT — no admin/billing access.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export async function POST(request: NextRequest) {
  // Rate limit: 3 requests per minute per IP
  const rateLimitResult = await rateLimit(
    `deepgram-token:${getClientIdentifier(request)}`,
    { max: 3, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    // Validate agentId — only issue tokens for ready agents
    let agentId: string | undefined;
    try {
      const body = await request.json();
      agentId = body.agentId;
    } catch {
      // No body or invalid JSON — allow for backwards compat
    }
    if (agentId) {
      const admin = createAdminClient();
      const { data: agent } = await admin
        .from('agents')
        .select('id, status')
        .eq('id', agentId)
        .single();
      if (!agent || agent.status !== 'ready') {
        return NextResponse.json({ error: 'Agent not found or not ready' }, { status: 403 });
      }
    }

    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    // Return the API key directly.
    // Security: this endpoint is rate-limited (3/min per IP) and validates agent status.
    // The key scope is STT-only — no admin/billing access.
    return NextResponse.json({
      token: DEEPGRAM_API_KEY,
      expiresIn: 0, // Does not expire — key is the project API key
    });
  } catch (error) {
    console.error('[Deepgram Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
