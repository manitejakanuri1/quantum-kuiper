import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAgent, createKnowledgeBase } from '@/lib/db';
import { scrapeWebsite } from '@/lib/scraper';
import { createKnowledgeBaseFromContent } from '@/lib/rag';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, websiteUrl, faceId, voiceId } = body;

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

        if (!name || !websiteUrl || !faceId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create agent first
        const agentId = uuidv4();

        // User ID from session might be email based, we need to ensure we have a valid user
        // For now, we'll use the email-based session id or generate one
        const userId = session.user.id || session.user.email || uuidv4();

        console.log('Using userId:', userId, 'agentId:', agentId);

        const agent = await createAgent({
            id: agentId,
            userId: userId,
            name,
            faceId,
            voiceId: assignedVoiceId,
            websiteUrl,
            status: 'active',
            createdAt: new Date()
        });

        console.log('Agent created successfully:', agent.id);

        // Scrape website in background (simplified for prototype)
        try {
            const scrapedData = await scrapeWebsite(websiteUrl, 5);
            const kb = createKnowledgeBaseFromContent(agentId, scrapedData.totalContent, websiteUrl);
            await createKnowledgeBase(kb);
        } catch (scrapeError) {
            console.error('Scraping error:', scrapeError);
            // Agent still created, just without knowledge base
        }

        return NextResponse.json({
            success: true,
            agent
        });
    } catch (error) {
        console.error('Error creating agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
