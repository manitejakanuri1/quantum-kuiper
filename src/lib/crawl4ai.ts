// Crawl4AI Cloud API Client
// Scrapes a single page and returns markdown + internal links
// API docs: https://api.crawl4ai.com/docs

import { isPublicUrl } from '@/lib/url-validation';

const CRAWL4AI_API_KEY = process.env.CRAWL4AI_API_KEY?.trim();
const CRAWL4AI_API_URL = 'https://api.crawl4ai.com/v1/crawl';
const REQUEST_TIMEOUT_MS = 15000; // 15s — Crawl4AI can take ~10s for JS-heavy pages

if (!CRAWL4AI_API_KEY) {
  console.warn('[Crawl4AI] CRAWL4AI_API_KEY not configured');
}

export interface ScrapedPage {
  url: string;
  title: string;
  markdown: string;
  internalLinks: string[];
  success: boolean;
  error?: string;
}

/**
 * Scrape a single page via Crawl4AI Cloud API.
 * Returns markdown content and internal links for BFS discovery.
 */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  if (!CRAWL4AI_API_KEY) {
    return { url, title: '', markdown: '', internalLinks: [], success: false, error: 'Crawl4AI API key not configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    console.log(`[Crawl4AI] Scraping: ${url}`);

    const response = await fetch(CRAWL4AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CRAWL4AI_API_KEY,
      },
      body: JSON.stringify({
        url,
        crawler_config: {
          type: 'CrawlerRunConfig',
          params: {
            cache_mode: 'bypass',
            word_count_threshold: 10,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Crawl4AI] HTTP ${response.status}: ${errorText}`);
      return { url, title: '', markdown: '', internalLinks: [], success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();

    // API returns result directly (not wrapped in results array)
    const result = data.results?.[0] || data;

    if (!result.success && result.success !== undefined) {
      return { url, title: '', markdown: '', internalLinks: [], success: false, error: result.error_message || 'Crawl4AI returned failure' };
    }

    // Extract markdown — handle multiple response formats
    let markdown = '';
    if (typeof result.markdown === 'string') {
      markdown = result.markdown;
    } else if (result.markdown?.raw_markdown) {
      markdown = result.markdown.raw_markdown;
    } else if (result.markdown?.fit_markdown) {
      markdown = result.markdown.fit_markdown;
    }

    // Extract title — API may return null metadata, so parse from HTML
    let title = result.metadata?.title || '';
    if (!title && result.html) {
      const titleMatch = result.html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      }
    }
    if (!title) title = 'Untitled';

    // Extract internal links — API links field may be empty, so also parse from HTML
    let internalLinks: string[] = [];
    if (result.links?.internal?.length > 0) {
      internalLinks = extractInternalLinksFromAPI(result.links, url);
    }
    if (internalLinks.length === 0 && result.html) {
      internalLinks = extractInternalLinksFromHTML(result.html, url);
    }

    console.log(`[Crawl4AI] Done: ${url} (${markdown.length} chars, ${internalLinks.length} links)`);

    return { url, title, markdown, internalLinks, success: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[Crawl4AI] Timeout scraping: ${url}`);
      return { url, title: '', markdown: '', internalLinks: [], success: false, error: 'Request timed out' };
    }
    console.error(`[Crawl4AI] Error scraping ${url}:`, error);
    return {
      url,
      title: '',
      markdown: '',
      internalLinks: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Link Extraction Helpers ───

// File extensions to skip
const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|mp3|mp4|avi|mov|css|js|woff|woff2|ttf|eot)$/i;

/**
 * Extract internal links from Crawl4AI API links field.
 */
function extractInternalLinksFromAPI(
  links: { internal?: Array<{ href: string }> },
  sourceUrl: string
): string[] {
  if (!links?.internal) return [];
  const hrefs = links.internal.map((l) => l.href).filter(Boolean);
  return filterInternalLinks(hrefs, sourceUrl);
}

/**
 * Extract internal links from raw HTML (fallback when API links field is empty).
 * Uses regex to find all <a href="..."> tags.
 */
function extractInternalLinksFromHTML(html: string, sourceUrl: string): string[] {
  const linkMatches = html.match(/<a[^>]+href=["']([^"'#][^"']*)["']/gi) || [];
  const hrefs: string[] = [];
  for (const match of linkMatches) {
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    if (hrefMatch?.[1]) {
      hrefs.push(hrefMatch[1]);
    }
  }
  return filterInternalLinks(hrefs, sourceUrl);
}

/**
 * Filter a list of URLs to only same-domain, public, non-media internal links.
 */
function filterInternalLinks(hrefs: string[], sourceUrl: string): string[] {
  let sourceHost: string;
  let sourceOrigin: string;
  try {
    const parsed = new URL(sourceUrl);
    // Normalize: treat www and non-www as same domain
    sourceHost = parsed.hostname.replace(/^www\./, '');
    // Keep the source origin (protocol + non-www host) for URL normalization
    sourceOrigin = `${parsed.protocol}//${sourceHost}`;
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const filtered: string[] = [];

  for (const href of hrefs) {
    let absoluteUrl: string;
    try {
      const parsed = new URL(href, sourceUrl);
      // Remove hash fragments and trailing slashes for dedup
      parsed.hash = '';
      absoluteUrl = parsed.href.replace(/\/+$/, '');
    } catch {
      continue;
    }

    // Skip non-http(s) schemes
    if (!absoluteUrl.startsWith('http://') && !absoluteUrl.startsWith('https://')) continue;

    // Skip different domains (normalize www)
    let linkHost: string;
    try {
      const linkParsed = new URL(absoluteUrl);
      linkHost = linkParsed.hostname.replace(/^www\./, '');
      if (linkHost !== sourceHost) continue;

      // Normalize www variants to match source domain (prevents duplicate queue entries)
      if (linkParsed.hostname !== linkHost) {
        linkParsed.hostname = linkHost;
        absoluteUrl = linkParsed.href.replace(/\/+$/, '');
      }
    } catch {
      continue;
    }

    // Skip if already seen (after normalization)
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    // Skip media/binary files
    if (SKIP_EXTENSIONS.test(absoluteUrl)) continue;

    // Skip mailto, tel, javascript links
    if (/^(mailto:|tel:|javascript:)/i.test(absoluteUrl)) continue;

    // SSRF check
    if (!isPublicUrl(absoluteUrl)) continue;

    filtered.push(absoluteUrl);
  }

  return filtered;
}

/**
 * Check if Crawl4AI is properly configured
 */
export function isCrawl4AIConfigured(): boolean {
  return !!CRAWL4AI_API_KEY;
}
