// Simli Session Token API
// POST /api/auth/simli-token
// Generates a session token for client-side Simli WebRTC connections.
// The real API key never leaves the server.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { requireJsonContentType } from '@/lib/request-validation';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const { faceId, agentId } = body as { faceId: string; agentId?: string };

    // Validate agentId — only issue tokens for ready agents
    // Also resolve custom face if available
    let resolvedFaceId = faceId;
    if (agentId) {
      const admin = createAdminClient();

      // Try with custom face columns first (migration 005)
      let { data: agent, error: agentError } = await admin
        .from('agents')
        .select('id, status, custom_face_id, custom_face_status')
        .eq('id', agentId)
        .single();

      // Fallback if custom columns don't exist yet (migration 005 not applied)
      if (agentError?.message?.includes('does not exist')) {
        const fallback = await admin
          .from('agents')
          .select('id, status')
          .eq('id', agentId)
          .single();
        agent = fallback.data as typeof agent;
      }

      if (!agent || agent.status !== 'ready') {
        return NextResponse.json({ error: 'Agent not found or not ready' }, { status: 403 });
      }

      // Use custom face if ready, otherwise fall back to the requested faceId
      if (agent?.custom_face_id && agent?.custom_face_status === 'ready') {
        resolvedFaceId = agent.custom_face_id;
        console.log(`[Simli Token] Using custom face ${resolvedFaceId} for agent ${agentId}`);
      }
    }

    if (!resolvedFaceId || typeof resolvedFaceId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(resolvedFaceId)) {
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
        faceId: resolvedFaceId,
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

    // Debug: log what Simli returned (helps diagnose connection failures)
    console.log('[Simli Token] API key set:', !!SIMLI_API_KEY);
    console.log('[Simli Token] Face ID:', resolvedFaceId, faceId !== resolvedFaceId ? `(custom, original: ${faceId})` : '');
    console.log('[Simli Token] Response keys:', Object.keys(data));
    console.log('[Simli Token] Has session_token:', !!data.session_token);

    if (!data.session_token) {
      console.error('[Simli Token] No session_token in response:', JSON.stringify(data).slice(0, 200));
      return NextResponse.json(
        { error: 'Simli returned no session token' },
        { status: 502 }
      );
    }

    // Fetch ICE servers for P2P WebRTC (keeps API key server-side)
    let iceServers: RTCIceServer[] | null = null;
    try {
      const iceRes = await fetch('https://api.simli.ai/getIceServers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: SIMLI_API_KEY }),
      });
      if (iceRes.ok) {
        iceServers = await iceRes.json();
        console.log('[Simli Token] ICE servers fetched:', Array.isArray(iceServers) ? iceServers.length : 'non-array');
      }
    } catch (iceErr) {
      console.warn('[Simli Token] ICE servers fetch failed (will use livekit fallback):', iceErr);
    }

    // Return session token + ICE servers — API key never leaves server
    return NextResponse.json({
      sessionToken: data.session_token,
      iceServers,
    });
  } catch (error) {
    console.error('[Simli Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
