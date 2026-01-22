// Crawl Website API Endpoint
// Triggers Firecrawl ONE TIME per agent and stores results in Supabase

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { crawlWebsite, isFirecrawlConfigured } from '@/lib/firecrawl';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePreviewPrompt } from '@/lib/prompt-generator';

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

        const body = await request.json();
        const { websiteUrl, agentId } = body;

        if (!websiteUrl || !agentId) {
            return NextResponse.json(
                { error: 'Missing websiteUrl or agentId' },
                { status: 400 }
            );
        }

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
                console.error('Error inserting pages:', insertError);
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
            previewPrompt: previewPrompt,
            message: `Successfully crawled ${crawlResult.totalPages} pages`
        });

    } catch (error) {
        console.error('Crawl API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
