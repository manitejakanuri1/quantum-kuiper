// Crawl Website API Endpoint
// Triggers Firecrawl ONE TIME per agent and stores results in Supabase

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { crawlWebsite, isFirecrawlConfigured } from '@/lib/firecrawl';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePreviewPrompt } from '@/lib/prompt-generator';
import { getAgentById } from '@/lib/db';
import { crawlWebsiteSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

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

        // SECURITY FIX: Validate input with Zod schema (replaces manual validation)
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
        const { data: existingPages } = await supabaseAdmin
            .from('website_pages')
            .select('id')
            .eq('agent_id', agentId)
            .limit(1);

        if (existingPages && existingPages.length > 0) {
            return NextResponse.json(
                { error: 'Website already crawled. Use Reindex to re-crawl.' },
                { status: 400 }
            );
        }

        // Update agent status to 'crawling'
        await supabaseAdmin
            .from('agents')
            .update({ crawl_status: 'crawling' })
            .eq('id', agentId);

        // Crawl website using Firecrawl (ONE TIME)
        const crawlResult = await crawlWebsite(websiteUrl, 30);

        if (!crawlResult.success) {
            await supabaseAdmin
                .from('agents')
                .update({ crawl_status: 'failed' })
                .eq('id', agentId);

            return NextResponse.json(
                { error: crawlResult.error || 'Crawl failed' },
                { status: 500 }
            );
        }

        // Store each page in Supabase
        const pagesToInsert = crawlResult.pages.map(page => ({
            agent_id: agentId,
            website_url: websiteUrl,
            page_url: page.url,
            page_title: page.title,
            extracted_text: page.content
        }));

        if (pagesToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('website_pages')
                .insert(pagesToInsert);

            if (insertError) {
                logger.error('Error inserting crawled pages', {
                    agentId,
                    error: insertError
                });
                await supabaseAdmin
                    .from('agents')
                    .update({ crawl_status: 'failed' })
                    .eq('id', agentId);

                return NextResponse.json(
                    { error: 'Failed to store crawled content' },
                    { status: 500 }
                );
            }
        }

        // NEW: Call backend to populate RAG knowledge base with embeddings
        let chunksStored = 0;
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
                logger.info('RAG knowledge base populated', {
                    agentId,
                    chunksStored
                });
            } else {
                const errorData = await ragResponse.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`RAG storage failed: ${errorData.error || ragResponse.statusText}`);
            }
        } catch (ragError) {
            logger.warn('RAG population error (non-fatal)', {
                agentId,
                error: ragError
            });
            // Don't fail the whole crawl if RAG fails
        }

        // Generate preview system prompt from crawled content
        const previewPrompt = generatePreviewPrompt(crawlResult.pages);

        // Update agent with completion status and preview prompt
        await supabaseAdmin
            .from('agents')
            .update({
                crawl_status: 'completed',
                crawl_completed_at: new Date().toISOString(),
                pages_crawled: crawlResult.totalPages,
                preview_system_prompt: previewPrompt
            })
            .eq('id', agentId);

        return NextResponse.json({
            success: true,
            pagesCount: crawlResult.totalPages,
            chunksStored: chunksStored,
            previewPrompt: previewPrompt,
            message: `Successfully crawled ${crawlResult.totalPages} pages and stored ${chunksStored} chunks in knowledge base`
        });

    } catch (error) {
        // SECURITY FIX: Proper error handling with validation awareness
        if (error instanceof z.ZodError) {
            logger.warn('Validation failed in crawl-website API', { errors: error.errors });
            return NextResponse.json(
                { error: 'Invalid input', details: error.errors },
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
