import { NextRequest, NextResponse } from 'next/server';
import { generateTTSAudio } from '@/lib/fishaudio';
import { ttsRequestSchema } from '@/lib/validation';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export async function POST(request: NextRequest) {
    try {
        // SECURITY FIX: Add rate limiting (10 requests per minute per IP)
        const clientId = getClientIdentifier(request);
        const rateLimitResult = rateLimit(clientId, {
            max: 10,
            windowMs: 60 * 1000
        });
        if (rateLimitResult) {
            logger.warn('TTS rate limit exceeded', { clientId });
            return rateLimitResult;
        }

        // SECURITY FIX: Validate input with Zod schema
        const body = await request.json();
        const validatedData = ttsRequestSchema.parse(body);
        const { text, voiceId } = validatedData;

        logger.info('TTS request', {
            textLength: text.length,
            voiceId,
            clientId
        });

        // Generate audio using FishAudio API
        const audioBuffer = await generateTTSAudio(text, voiceId);

        if (!audioBuffer) {
            return NextResponse.json(
                { error: 'Failed to generate audio', fallback: true },
                { status: 500 }
            );
        }

        // Return audio as binary response
        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });
    } catch (error) {
        // SECURITY FIX: Proper error handling with validation awareness
        if (error instanceof z.ZodError) {
            logger.warn('Validation failed in TTS API', { errors: error.errors });
            return NextResponse.json(
                { error: 'Invalid input', details: error.errors },
                { status: 400 }
            );
        }

        logger.error('TTS API error', { error });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
