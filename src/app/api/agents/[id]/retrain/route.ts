import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentById, getKnowledgeBaseByAgentId, updateKnowledgeBase, createKnowledgeBase } from '@/lib/db';
import { scrapeWebsite } from '@/lib/scraper';
import { createKnowledgeBaseFromContent } from '@/lib/rag';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agent = await getAgentById(id);
        if (!agent || agent.userId !== session.user.id) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Re-scrape website
        const scrapedData = await scrapeWebsite(agent.websiteUrl || '', 5);
        const newKb = createKnowledgeBaseFromContent(id, scrapedData.totalContent, agent.websiteUrl);

        // Update or create knowledge base
        const existingKb = await getKnowledgeBaseByAgentId(id);
        if (existingKb) {
            await updateKnowledgeBase(existingKb.id, {
                sourceUrl: newKb.sourceUrl,
                chunks: newKb.chunks,
                status: 'ready'
            });
        } else {
            await createKnowledgeBase(newKb);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error retraining agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
