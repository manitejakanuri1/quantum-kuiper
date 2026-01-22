import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAgent } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, websiteUrl, faceId, voiceId, systemPrompt } = body;

        // Face to voice mapping (auto-assign based on face gender)
        const FACE_VOICE_MAP: Record<string, string> = {
            'cace3ef7-a4c4-425d-a8cf-a5358eb0c427': '4a98f7c293ee44898705529cc8ccc7d6', // Tina → Kawaii Female
            'f0ba4efe-7946-45de-9955-c04a04c367b9': '4a98f7c293ee44898705529cc8ccc7d6', // Doctor → Kawaii Female
            '7e74d6e7-d559-4394-bd56-4923a3ab75ad': 'default-male', // Sabour → Male (OpenAI)
            '804c347a-26c9-4dcf-bb49-13df4bed61e8': 'default-male', // Mark → Male (OpenAI)
        };

        // Auto-assign voice based on face if not provided
        const assignedVoiceId = voiceId || FACE_VOICE_MAP[faceId] || '4a98f7c293ee44898705529cc8ccc7d6';

        console.log('Creating agent with data:', { name, websiteUrl, faceId, voiceId: assignedVoiceId, userId: session.user.id });

        if (!name || !faceId) {
            return NextResponse.json({ error: 'Missing required fields (name and faceId)' }, { status: 400 });
        }

        // Create agent
        const agentId = uuidv4();

        // Ensure userId is always a valid UUID
        // If session.user.id is missing or not a UUID, generate a deterministic UUID from email
        let userId = session.user.id;
        if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            // Generate deterministic UUID from email using a simple hash approach
            const email = session.user.email || 'anonymous@user.com';
            // Create a UUID v5-like deterministic ID from email
            const emailHash = email.split('').reduce((hash: number, char: string) => {
                return ((hash << 5) - hash) + char.charCodeAt(0);
            }, 0);
            userId = `${Math.abs(emailHash).toString(16).padStart(8, '0')}-0000-4000-8000-${Date.now().toString(16).slice(-12).padStart(12, '0')}`;
        }

        console.log('Using userId:', userId, 'agentId:', agentId);

        const agent = await createAgent({
            id: agentId,
            userId: userId,
            name,
            faceId,
            voiceId: assignedVoiceId,
            websiteUrl: websiteUrl || '',
            systemPrompt: systemPrompt || '',
            status: 'active',
            createdAt: new Date()
        });

        console.log('Agent created successfully:', agent.id);

        // NOTE: Website crawling is now handled by /api/crawl-website using Firecrawl
        // This runs ONE TIME per agent after creation

        return NextResponse.json({
            success: true,
            agent
        });
    } catch (error) {
        console.error('Error creating agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

