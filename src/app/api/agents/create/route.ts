import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAgent } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit: 10 agent creations per hour per user
        const rateLimitResult = rateLimit(`agent-create:${session.user.id}`, {
            max: 10,
            windowMs: 60 * 60 * 1000 // 1 hour
        });

        if (rateLimitResult) {
            return rateLimitResult;
        }

        const body = await request.json();
        const { name, websiteUrl, faceId, voiceId, systemPrompt } = body;

        // Face to voice mapping (auto-assign based on face gender)
        const FACE_VOICE_MAP: Record<string, string> = {
            // Female faces → Realistic female voices
            'cace3ef7-a4c4-425d-a8cf-a5358eb0c427': '1b160c4cf02e4855a09efd59475b9370', // Tina → Sophia (Professional)
            'f0ba4efe-7946-45de-9955-c04a04c367b9': 'ab9f86c943514589a52c00f55088e1ae', // Doctor → E Girl (Playful)

            // Male faces → Realistic male voices
            '7e74d6e7-d559-4394-bd56-4923a3ab75ad': '76f7e17483084df6b0f1bcecb5fb13e9', // Sabour → Marcus (Confident)
            '804c347a-26c9-4dcf-bb49-13df4bed61e8': '34b01f00fd8f4e12a664d1e081c13312', // Mark → David (Friendly)
        };

        // Auto-assign voice based on face if not provided (defaults to Sophia - Professional Female)
        const assignedVoiceId = voiceId || FACE_VOICE_MAP[faceId] || '1b160c4cf02e4855a09efd59475b9370';

        logger.info('Creating agent', {
            name,
            faceId,
            voiceId: assignedVoiceId,
            userId: session.user.id,
            hasWebsiteUrl: !!websiteUrl
        });

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

        logger.debug('User ID assignment', { userId, agentId });

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

        logger.info('Agent created successfully', { agentId: agent.id, userId });

        // NOTE: Website crawling is now handled by /api/crawl-website using Firecrawl
        // This runs ONE TIME per agent after creation

        // NEW: Automatically trigger website crawling if websiteUrl is provided
        if (websiteUrl && websiteUrl.trim() !== '') {
            logger.info('Auto-triggering website crawl', { agentId, websiteUrl });

            // Trigger crawl in background (don't wait for completion)
            const crawlUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/crawl-website`;

            fetch(crawlUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': request.headers.get('Cookie') || ''
                },
                body: JSON.stringify({
                    websiteUrl: websiteUrl,
                    agentId: agentId
                })
            }).catch(error => {
                logger.error('Auto-crawl failed (non-fatal)', { agentId, error });
                // Don't fail agent creation if crawl fails
            });

            logger.info('Website crawl triggered in background', { agentId });

            return NextResponse.json({
                success: true,
                agent,
                crawlTriggered: true,
                message: 'Agent created. Crawling website in background...'
            });
        }

        return NextResponse.json({
            success: true,
            agent,
            crawlTriggered: false,
            message: 'Agent created successfully'
        });
    } catch (error) {
        logger.error('Error creating agent', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
