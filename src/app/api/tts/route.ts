// Text-to-Speech API — Server-side Fish Audio TTS
// POST /api/tts
// Converts text to audio via Fish Audio API (key stays server-side)

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { requireJsonContentType } from '@/lib/request-validation';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_AUDIO_API_URL = 'https://api.fish.audio/v1/tts';

// CORS headers for cross-origin widget/embed access
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 requests per minute per IP
  const rateLimitResult = await rateLimit(
    `tts:${getClientIdentifier(request)}`,
    { max: 30, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  const contentTypeError = requireJsonContentType(request);
  if (contentTypeError) return contentTypeError;

  try {
    if (!FISH_AUDIO_API_KEY) {
      return NextResponse.json(
        { error: 'Fish Audio API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, voiceId } = body as { text: string; voiceId: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(voiceId)) {
      return NextResponse.json(
        { error: 'Invalid voice ID' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Text too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    console.log(`[TTS] Generating audio: "${text.slice(0, 50)}..." with voice ${voiceId}`);

    // Call Fish Audio API
    const ttsResponse = await fetch(FISH_AUDIO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        reference_id: voiceId,
        format: 'mp3',
        mp3_bitrate: 128,
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error(`[TTS] Fish Audio error ${ttsResponse.status}:`, errorText);
      return NextResponse.json(
        { error: 'TTS generation failed' },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    // Stream the audio response back to the client
    const audioBuffer = await ttsResponse.arrayBuffer();

    console.log(`[TTS] Audio generated: ${audioBuffer.byteLength} bytes`);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('[TTS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
