/**
 * Setup multiple test agents with different websites for multi-agent testing
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { crawlAndStore } = require('./lib/firecrawl');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test websites across different industries
const testWebsites = [
    {
        name: "Coffee Shop Agent",
        url: "https://www.bluebottlecoffee.com"
    },
    {
        name: "Restaurant Agent",
        url: "https://www.sweetgreen.com"
    },
    {
        name: "Fitness Agent",
        url: "https://www.orangetheory.com"
    },
    {
        name: "Dental Agent",
        url: "https://www.aspendentalcom"
    }
];

async function createTestAgent(name, websiteUrl) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 Creating agent: ${name}`);
    console.log(`📍 Website: ${websiteUrl}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
        // Check if agent already exists with this website
        const { data: existingKB } = await supabase
            .from('knowledge_bases')
            .select('id, agent_id, agents(name)')
            .eq('source_url', websiteUrl)
            .single();

        if (existingKB) {
            console.log(`✅ Agent already exists: ${existingKB.agents.name}`);
            console.log(`   Reusing agent ID: ${existingKB.agent_id}\n`);
            return existingKB.agent_id;
        }

        // Create new agent
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .insert({
                name: name,
                voice_id: 'default'
            })
            .select()
            .single();

        if (agentError) {
            console.error(`❌ Error creating agent:`, agentError);
            return null;
        }

        console.log(`✅ Created agent: ${agent.name} (${agent.id})`);

        // Crawl and store website
        console.log(`\n🕷️  Crawling website: ${websiteUrl}`);
        console.log(`   This may take 1-2 minutes...`);

        await crawlAndStore(agent.id, websiteUrl);

        // Verify chunks and embeddings
        const { data: kb } = await supabase
            .from('knowledge_bases')
            .select('id')
            .eq('agent_id', agent.id)
            .eq('source_url', websiteUrl)
            .single();

        if (!kb) {
            console.error(`❌ Knowledge base not created`);
            return null;
        }

        const { count: totalChunks } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('kb_id', kb.id);

        const { count: withEmbeddings } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('kb_id', kb.id)
            .not('embedding', 'is', null);

        console.log(`\n✅ Agent setup complete!`);
        console.log(`   Total Chunks: ${totalChunks}`);
        console.log(`   With Embeddings: ${withEmbeddings}`);
        console.log(`   Embedding Coverage: ${totalChunks > 0 ? ((withEmbeddings / totalChunks) * 100).toFixed(1) : 0}%`);

        return agent.id;

    } catch (error) {
        console.error(`❌ Error setting up agent:`, error.message);
        return null;
    }
}

async function setupMultipleAgents() {
    console.log('\n🚀 Setting Up Test Agents for Multi-Agent RAG Testing\n');

    const agentIds = [];

    for (const website of testWebsites) {
        const agentId = await createTestAgent(website.name, website.url);
        if (agentId) {
            agentIds.push(agentId);
        }

        // Wait 2 seconds between crawls to avoid rate limiting
        if (agentIds.length < testWebsites.length) {
            console.log(`\n⏳ Waiting 2 seconds before next crawl...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Setup Complete!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\nCreated ${agentIds.length} agents:`);
    agentIds.forEach((id, idx) => {
        console.log(`   ${idx + 1}. ${id}`);
    });

    console.log(`\n💡 You can now run: node test-multi-agent-rag.js`);
}

setupMultipleAgents().catch(console.error);
