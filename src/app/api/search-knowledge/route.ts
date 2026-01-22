// Search Knowledge API Endpoint
// Retrieval-based search from stored website content (NO LLM)

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { agentId, query } = body;

        if (!agentId || !query) {
            return NextResponse.json(
                { error: 'Missing agentId or query' },
                { status: 400 }
            );
        }

        // Search stored website pages using PostgreSQL full-text search
        // NO LLM - Pure retrieval from database
        const { data: pages, error } = await supabase
            .from('website_pages')
            .select('page_url, page_title, extracted_text')
            .eq('agent_id', agentId)
            .textSearch('extracted_text', query, {
                type: 'websearch',
                config: 'english'
            })
            .limit(5);

        if (error) {
            console.error('Search error:', error);

            // Fallback to simple ILIKE search if full-text fails
            const { data: fallbackPages, error: fallbackError } = await supabase
                .from('website_pages')
                .select('page_url, page_title, extracted_text')
                .eq('agent_id', agentId)
                .ilike('extracted_text', `%${query}%`)
                .limit(5);

            if (fallbackError || !fallbackPages || fallbackPages.length === 0) {
                return NextResponse.json({
                    found: false,
                    answer: "I don't have that information on the website.",
                    sources: []
                });
            }

            return formatResponse(fallbackPages, query);
        }

        if (!pages || pages.length === 0) {
            return NextResponse.json({
                found: false,
                answer: "I don't have that information on the website.",
                sources: []
            });
        }

        return formatResponse(pages, query);

    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

interface PageResult {
    page_url: string;
    page_title: string;
    extracted_text: string;
}

function formatResponse(pages: PageResult[], query: string) {
    // Extract relevant snippets from the content
    const results = pages.map(page => {
        // Find the most relevant snippet containing the query terms
        const snippet = extractRelevantSnippet(page.extracted_text, query);
        return {
            title: page.page_title,
            url: page.page_url,
            snippet
        };
    });

    // Combine snippets into a response (deterministic, no LLM)
    const combinedAnswer = results
        .map(r => r.snippet)
        .filter(s => s.length > 0)
        .join(' ');

    return NextResponse.json({
        found: true,
        answer: combinedAnswer || "Found relevant pages but no specific answer.",
        sources: results.map(r => ({ title: r.title, url: r.url }))
    });
}

function extractRelevantSnippet(text: string, query: string, maxLength: number = 500): string {
    const lowerText = text.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    // Find the first occurrence of any query term
    let bestIndex = -1;
    for (const term of queryTerms) {
        const index = lowerText.indexOf(term);
        if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
            bestIndex = index;
        }
    }

    if (bestIndex === -1) {
        // No match found, return beginning of text
        return text.slice(0, maxLength).trim();
    }

    // Extract snippet around the match
    const start = Math.max(0, bestIndex - 100);
    const end = Math.min(text.length, bestIndex + maxLength - 100);

    let snippet = text.slice(start, end).trim();

    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
}
