/**
 * Crawl existing agents that don't have knowledge bases yet
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// These are the agents we just created
const agentsToCrawl = [
    { id: 'b70fd02a-9360-45b5-9e29-5440eced2a64', name: 'Coffee Shop Agent', url: 'https://www.bluebottlecoffee.com' },
    { id: 'af27770f-a57d-46d9-841c-aaaf5d043cff', name: 'Restaurant Agent', url: 'https://www.sweetgreen.com' },
    { id: '5eef743c-5ca8-4b5f-98e4-9f016fc28ef2', name: 'Fitness Agent', url: 'https://www.orangetheory.com' },
    { id: '663b2e0f-e8c3-47ba-a91e-f67b4cc83c10', name: 'Dental Agent', url: 'https://www.aspendental.com' },
    { id: '5e3e68df-8a7c-4a52-aa51-c3b94034c74d', name: 'Auto Repair Agent', url: 'https://www.jiffy.com' },
    { id: 'ee6f4a7f-3bfc-42ef-9ac5-c0ea1605b921', name: 'Vet Agent', url: 'https://www.banfield.com' },
    { id: '5e23ede4-5470-4f91-b6b0-d5eb7b80d5ee', name: 'Law Firm Agent', url: 'https://www.nolo.com' },
    { id: 'e56dd463-0915-4240-8050-60485806ab34', name: 'Real Estate Agent', url: 'https://www.zillow.com' },
    { id: 'b3759160-4ec1-4fb5-9fbe-c3f91cb19be8', name: 'Medical Agent', url: 'https://www.onemedical.com' }
];

async function crawlAgent(agent) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🕷️  Crawling: ${agent.name}`);
    console.log(`📍 Website: ${agent.url}`);
    console.log(`🆔 Agent ID: ${agent.id}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
        const crawlResponse = await fetch('http://localhost:8080/api/crawl-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: agent.id,
                websiteUrl: agent.url
            })
        });

        if (!crawlResponse.ok) {
            const error = await crawlResponse.json();
            throw new Error(`Crawl failed: ${JSON.stringify(error)}`);
        }

        const crawlData = await crawlResponse.json();
        console.log(`✅ Crawl complete!`);
        console.log(`   Pages crawled: ${crawlData.pagesCount}`);
        console.log(`   Chunks stored: ${crawlData.chunksStored}`);

        // Verify embeddings
        const { data: kb } = await supabase
            .from('knowledge_bases')
            .select('id')
            .eq('agent_id', agent.id)
            .single();

        if (kb) {
            const { count: withEmbeddings } = await supabase
                .from('document_chunks')
                .select('*', { count: 'exact', head: true })
                .eq('kb_id', kb.id)
                .not('embedding', 'is', null);

            console.log(`   With embeddings: ${withEmbeddings}`);
            console.log(`   Coverage: ${crawlData.chunksStored > 0 ? ((withEmbeddings / crawlData.chunksStored) * 100).toFixed(1) : 0}%`);
        }

        return true;

    } catch (error) {
        console.error(`❌ Error crawling ${agent.name}:`, error.message);
        return false;
    }
}

async function crawlAllAgents() {
    console.log('🚀 Crawling 9 Agents for Multi-Agent Testing\n');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < agentsToCrawl.length; i++) {
        const agent = agentsToCrawl[i];
        const success = await crawlAgent(agent);

        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Wait 2 seconds between crawls to avoid rate limiting
        if (i < agentsToCrawl.length - 1) {
            console.log(`\n⏳ Waiting 2 seconds before next crawl...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Crawling Complete!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\nSuccess: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`\n💡 You can now run: node test-multi-agent-rag.js\n`);
}

crawlAllAgents().catch(console.error);
