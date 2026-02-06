// Crawl Website API Endpoint
// Triggers Firecrawl ONE TIME per agent and stores results in Firestore

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { crawlWebsite, isFirecrawlConfigured } from '@/lib/firecrawl';
import { firestoreHelpers, Timestamp } from '@/lib/firestore';
import { generatePreviewPrompt } from '@/lib/prompt-generator';
import { getAgentById, updateAgent } from '@/lib/db';
import { crawlWebsiteSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if Firecrawl is configured
        if (!isFirecrawlConfigured()) {
            return NextResponse.json(
                { error: 'Firecrawl API key not configured' },
                { status: 500 }
            );
        }

        // SECURITY FIX: Validate input with Zod schema
        const body = await request.json();
        const validatedData = crawlWebsiteSchema.parse(body);
        const { websiteUrl, agentId } = validatedData;

        // SECURITY FIX: Verify agent ownership BEFORE crawling
        const agent = await getAgentById(agentId);
        if (!agent || agent.userId !== session.user.id) {
            logger.warn('Attempted crawl of unauthorized agent', {
                userId: session.user.id,
                agentId
            });
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        logger.info('Starting website crawl', {
            agentId,
            userId: session.user.id,
            websiteUrl
        });

        // Check if agent already has crawled content (prevent duplicate crawls)
        const existingPages = await firestoreHelpers.queryDocuments<any>(
            'websitePages',
            [{ field: 'agentId', operator: '==', value: agentId }],
            undefined,
            1
        );

        if (existingPages && existingPages.length > 0) {
            return NextResponse.json(
                { error: 'Website already crawled. Use Reindex to re-crawl.' },
                { status: 400 }
            );
        }

        // Update agent status to 'crawling'
        await updateAgent(agentId, { status: 'training' });

        // Crawl website using Firecrawl (ONE TIME)
        const crawlResult = await crawlWebsite(websiteUrl, 30);

        if (!crawlResult.success) {
            await updateAgent(agentId, { status: 'inactive' });
            return NextResponse.json(
                { error: crawlResult.error || 'Crawl failed' },
                { status: 500 }
            );
        }

        // Store each page in Firestore
        for (const page of crawlResult.pages) {
            const pageId = uuidv4();
            await firestoreHelpers.setDocument('websitePages', pageId, {
                agentId,
                websiteUrl,
                pageUrl: page.url,
                pageTitle: page.title,
                extractedText: page.content,
                crawledAt: Timestamp.now(),
            });
        }

        // Call backend to populate RAG knowledge base with embeddings
        let chunksStored = 0;
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const ragResponse = await fetch(`${backendUrl}/api/crawl-website`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: agentId,
                    websiteUrl: websiteUrl
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (ragResponse.ok) {
                const ragData = await ragResponse.json();
                if (!ragData.success || ragData.chunksStored === 0) {
                    throw new Error('RAG knowledge base population failed: no chunks stored');
                }
                chunksStored = ragData.chunksStored;
                logger.info('RAG knowledge base populated', { agentId, chunksStored });
            } else {
                const errorData = await ragResponse.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`RAG storage failed: ${errorData.error || ragResponse.statusText}`);
            }
        } catch (ragError) {
            logger.warn('RAG population error (non-fatal)', { agentId, error: ragError });
        }

        // Generate preview system prompt from crawled content
        const previewPrompt = generatePreviewPrompt(crawlResult.pages);

        // Update agent with completion status
        await firestoreHelpers.updateDocument('agents', agentId, {
            status: 'active',
            crawlStatus: 'completed',
            crawlCompletedAt: Timestamp.now(),
            pagesCrawled: crawlResult.totalPages,
            previewSystemPrompt: previewPrompt,
        });

        return NextResponse.json({
            success: true,
            pagesCount: crawlResult.totalPages,
            chunksStored: chunksStored,
            previewPrompt: previewPrompt,
            message: `Successfully crawled ${crawlResult.totalPages} pages and stored ${chunksStored} chunks in knowledge base`
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.warn('Validation failed in crawl-website API', { errors: error.issues });
            return NextResponse.json(
                { error: 'Invalid input', details: error.issues },
                { status: 400 }
            );
        }

        logger.error('Crawl API error', { error });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
