/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
const { crawlWebsite } = require('../backend/lib/firecrawl');
const { storeKnowledge } = require('../backend/lib/retrieval');

async function main() {
    const url = process.argv[2];
    const agentId = process.argv[3];

    if (!url || !agentId) {
        console.error('❌ Usage: node crawl-website.js <url> <agent-id>');
        console.error('   Example: node crawl-website.js https://www.usaplumbingservice.com abc-123');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🌐 Website Crawling + Knowledge Base Storage');
    console.log('═'.repeat(60));
    console.log(`URL: ${url}`);
    console.log(`Agent ID: ${agentId}`);
    console.log('═'.repeat(60));

    // Step 1: Crawl website
    const crawlResult = await crawlWebsite(url);

    if (!crawlResult.success) {
        console.error(`❌ Crawl failed: ${crawlResult.error}`);
        process.exit(1);
    }

    console.log(`\n✅ Successfully crawled ${crawlResult.pages.length} pages`);

    // Step 2: Store in knowledge base
    console.log('\n📚 Storing in knowledge base...');
    const totalChunks = await storeKnowledge(agentId, crawlResult.pages);

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ COMPLETE: ${totalChunks} chunks stored`);
    console.log('═'.repeat(60));
    console.log('\n🎤 Agent ready for voice queries!');
}

main().catch(console.error);
