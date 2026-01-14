// Web Scraper for Website Ingestion
// Extracts content from user's website for RAG knowledge base

import * as cheerio from 'cheerio';

export interface ScrapedPage {
    url: string;
    title: string;
    content: string;
    links: string[];
}

export interface ScrapedWebsite {
    mainUrl: string;
    pages: ScrapedPage[];
    totalContent: string;
}

// Scrape a single page
async function scrapePage(url: string): Promise<ScrapedPage> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'VoiceAgentBot/1.0 (Website Content Extractor)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script, style, nav, footer, header, aside, iframe, noscript').remove();

        // Extract title
        const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

        // Extract main content
        const contentSelectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '.main-content',
            '#content',
            '#main',
            'body'
        ];

        let content = '';
        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length && element.text().trim().length > 100) {
                content = element.text().trim();
                break;
            }
        }

        // Clean up content
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        // Extract internal links
        const baseUrl = new URL(url);
        const links: string[] = [];
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                try {
                    const linkUrl = new URL(href, url);
                    if (linkUrl.hostname === baseUrl.hostname && !links.includes(linkUrl.href)) {
                        links.push(linkUrl.href);
                    }
                } catch {
                    // Invalid URL, skip
                }
            }
        });

        return {
            url,
            title,
            content,
            links: links.slice(0, 20) // Limit to 20 internal links
        };
    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return {
            url,
            title: 'Error',
            content: '',
            links: []
        };
    }
}

// Scrape entire website (limited depth)
export async function scrapeWebsite(mainUrl: string, maxPages: number = 10): Promise<ScrapedWebsite> {
    const visited = new Set<string>();
    const pages: ScrapedPage[] = [];
    const toVisit: string[] = [mainUrl];

    while (toVisit.length > 0 && pages.length < maxPages) {
        const url = toVisit.shift()!;

        if (visited.has(url)) continue;
        visited.add(url);

        const page = await scrapePage(url);
        if (page.content.length > 50) {
            pages.push(page);

            // Add new links to visit
            for (const link of page.links) {
                if (!visited.has(link) && !toVisit.includes(link)) {
                    toVisit.push(link);
                }
            }
        }
    }

    // Combine all content
    const totalContent = pages
        .map(p => `## ${p.title}\n\n${p.content}`)
        .join('\n\n---\n\n');

    return {
        mainUrl,
        pages,
        totalContent
    };
}

// Extract key information for service businesses
export function extractBusinessInfo(content: string): {
    services: string[];
    contactInfo: string[];
    locations: string[];
} {
    const services: string[] = [];
    const contactInfo: string[] = [];
    const locations: string[] = [];

    // Simple pattern matching for common service business info
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    const phones = content.match(phonePattern) || [];
    const emails = content.match(emailPattern) || [];

    contactInfo.push(...phones, ...emails);

    // Common service keywords
    const serviceKeywords = [
        'installation', 'repair', 'maintenance', 'replacement',
        'emergency', 'residential', 'commercial', 'service'
    ];

    serviceKeywords.forEach(keyword => {
        const regex = new RegExp(`[^.]*\\b${keyword}\\b[^.]*\\.`, 'gi');
        const matches = content.match(regex) || [];
        services.push(...matches.slice(0, 3));
    });

    return {
        services: [...new Set(services)].slice(0, 10),
        contactInfo: [...new Set(contactInfo)],
        locations
    };
}
