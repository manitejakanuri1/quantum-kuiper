import { NextRequest, NextResponse } from 'next/server';
import { generateTTSAudio } from '@/lib/fishaudio';

export async function POST(request: NextRequest) {
    try {
        const { text, voiceId } = await request.json();

        if (!text || !voiceId) {
            return NextResponse.json(
                { error: 'Missing text or voiceId' },
                { status: 400 }
            );
        }

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
        console.error('TTS API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
