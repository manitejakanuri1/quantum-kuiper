const FirecrawlApp = require('@mendable/firecrawl-js').default;

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
    console.warn('⚠️ FIRECRAWL_API_KEY not set - website crawling disabled');
}

const firecrawl = FIRECRAWL_API_KEY ? new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY }) : null;

/**
 * Crawl a website and extract content
 * @param {string} url - Website URL to crawl
 * @returns {Promise<{success: boolean, pages: Array, error?: string}>}
 */
async function crawlWebsite(url) {
    if (!firecrawl) {
        return { success: false, error: 'Firecrawl not configured' };
    }

    try {
        console.log(`🌐 Crawling website: ${url}`);

        const result = await firecrawl.crawlUrl(url, {
            limit: 50,  // Max 50 pages
            scrapeOptions: {
                formats: ['markdown'],
                onlyMainContent: true
            }
        });

        if (!result.success) {
            return { success: false, error: 'Crawl failed' };
        }

        const pages = result.data.map(page => ({
            url: page.url,
            title: page.metadata?.title || page.url,
            content: page.markdown || '',
            metadata: page.metadata || {}
        }));

        console.log(`✅ Crawled ${pages.length} pages from ${url}`);

        return { success: true, pages };
    } catch (error) {
        console.error('❌ Firecrawl error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Split text into chunks (basic - for backward compatibility)
 */
function chunkText(text, maxChunkSize = 500) {
    const sentences = text.split(/[.!?]\s+/);
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
}

/**
 * Enhanced chunking with overlap for better context preservation
 */
function enhancedChunkText(text, options = {}) {
    const {
        maxChunkSize = 800, // ~400-500 tokens (optimal for RAG per 2025 research)
        overlapSize = 120   // ~15% overlap for context preservation
    } = options;

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = '';
    let previousChunk = '';

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();

        // Skip empty sentences
        if (!sentence) continue;

        // Add sentence to current chunk
        const testChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;

        if (testChunk.length > maxChunkSize && currentChunk) {
            // Save current chunk
            const chunkToSave = currentChunk.trim();
            chunks.push(chunkToSave);

            // Create overlap: take last N characters from current chunk
            const overlapText = chunkToSave.slice(-overlapSize);

            // Find sentence boundary in overlap
            const lastSentenceEnd = overlapText.lastIndexOf('. ');
            const overlap = lastSentenceEnd > 0
                ? overlapText.slice(lastSentenceEnd + 2)
                : overlapText;

            // Start new chunk with overlap + current sentence
            currentChunk = `${overlap} ${sentence}`;
            previousChunk = chunkToSave;
        } else {
            currentChunk = testChunk;
        }
    }

    // Add final chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

module.exports = {
    crawlWebsite,
    chunkText,
    enhancedChunkText
};
