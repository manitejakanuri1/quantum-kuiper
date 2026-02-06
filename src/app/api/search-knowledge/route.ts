// Search Knowledge API Endpoint
// Retrieval-based search from stored website content (using Firestore)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { firestoreHelpers } from '@/lib/firestore';
import { searchKnowledgeSchema } from '@/lib/validation';
import { getAgentById } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Force dynamic rendering - don't evaluate at build time
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // SECURITY FIX: Add authentication
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // SECURITY FIX: Use Zod schema validation
        const body = await request.json();
        const validatedData = searchKnowledgeSchema.parse(body);
        const { agentId, query } = validatedData;

        // SECURITY FIX: Verify agent ownership
        const agent = await getAgentById(agentId);
        if (!agent || agent.userId !== session.user.id) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        // Search stored website pages from Firestore
        const pages = await firestoreHelpers.queryDocuments<any>(
            'websitePages',
            [{ field: 'agentId', operator: '==', value: agentId }]
        );

        if (!pages || pages.length === 0) {
            return NextResponse.json({
                found: false,
                answer: "I don't have that information on the website.",
                sources: []
            });
        }

        // Simple keyword matching search
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matchingPages = pages
            .filter(page => {
                const text = (page.extractedText || '').toLowerCase();
                return queryWords.some(word => text.includes(word));
            })
            .slice(0, 5);

        if (matchingPages.length === 0) {
            return NextResponse.json({
                found: false,
                answer: "I don't have that information on the website.",
                sources: []
            });
        }

        return formatResponse(matchingPages, query);

    } catch (error) {
        // SECURITY FIX: Proper error handling with logger
        if (error instanceof z.ZodError) {
            logger.warn('Validation failed in search API', { errors: error.issues });
            return NextResponse.json(
                { error: 'Invalid input', details: error.issues },
                { status: 400 }
            );
        }

        logger.error('Search API error', { error });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

interface PageResult {
    pageUrl: string;
    pageTitle: string;
    extractedText: string;
}

function formatResponse(pages: PageResult[], query: string) {
    // Extract relevant snippets from the content
    const results = pages.map(page => {
        const snippet = extractRelevantSnippet(page.extractedText || '', query);
        return {
            title: page.pageTitle || 'Untitled',
            url: page.pageUrl,
            snippet
        };
    });

    // Combine snippets into a response
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
        return text.slice(0, maxLength).trim();
    }

    // Extract snippet around the match
    const start = Math.max(0, bestIndex - 100);
    const end = Math.min(text.length, bestIndex + maxLength - 100);

    let snippet = text.slice(start, end).trim();

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
}
