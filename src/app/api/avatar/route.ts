import { NextRequest, NextResponse } from 'next/server';
import { startSimliSession, sendAudioToSimli } from '@/lib/simile';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // SECURITY FIX: Add rate limiting (5 session starts per minute per IP)
        const clientId = getClientIdentifier(request);
        const rateLimitResult = rateLimit(clientId, {
            max: 5,
            windowMs: 60 * 1000
        });
        if (rateLimitResult) {
            logger.warn('Avatar API rate limit exceeded', { clientId });
            return rateLimitResult;
        }

        const { action, faceId, sessionId, audioData } = await request.json();

        if (action === 'start') {
            // Start new Simli session
            if (!faceId) {
                return NextResponse.json({ error: 'Missing faceId' }, { status: 400 });
            }

            const session = await startSimliSession(faceId);

            if (!session) {
                logger.error('Failed to start Simli session', { faceId, clientId });
                return NextResponse.json(
                    { error: 'Failed to start Simli session', fallback: true },
                    { status: 500 }
                );
            }

            logger.info('Simli session started', { faceId, sessionId: session.sessionId, clientId });
            return NextResponse.json(session);
        }

        if (action === 'audio') {
            // Send audio to existing session
            if (!sessionId || !audioData) {
                return NextResponse.json(
                    { error: 'Missing sessionId or audioData' },
                    { status: 400 }
                );
            }

            // Decode base64 audio
            const audioBuffer = new Uint8Array(Buffer.from(audioData, 'base64')).buffer;
            const videoData = await sendAudioToSimli(sessionId, audioBuffer);

            if (!videoData) {
                return NextResponse.json(
                    { error: 'Failed to generate video' },
                    { status: 500 }
                );
            }

            // Return video as base64
            return NextResponse.json({
                video: Buffer.from(videoData).toString('base64')
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        // SECURITY FIX: Replace console.error with logger
        logger.error('Avatar API error', { error });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
