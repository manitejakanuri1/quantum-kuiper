/**
 * Setup 10 test agents directly via database for multi-agent testing
 * Creates agents and manually triggers crawling
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test websites across different industries
const testWebsites = [
    {
        name: "Coffee Shop Agent",
        url: "https://www.bluebottlecoffee.com",
        industry: "coffee"
    },
    {
        name: "Restaurant Agent",
        url: "https://www.sweetgreen.com",
        industry: "restaurant"
    },
    {
        name: "Fitness Agent",
        url: "https://www.orangetheory.com",
        industry: "fitness"
    },
    {
        name: "Dental Agent",
        url: "https://www.aspendental.com",
        industry: "dental"
    },
    {
        name: "Auto Repair Agent",
        url: "https://www.jiffy.com",
        industry: "auto"
    },
    {
        name: "Vet Agent",
        url: "https://www.banfield.com",
        industry: "vet"
    },
    {
        name: "Law Firm Agent",
        url: "https://www.nolo.com",
        industry: "law"
    },
    {
        name: "Real Estate Agent",
        url: "https://www.zillow.com",
        industry: "realestate"
    },
    {
        name: "Medical Agent",
        url: "https://www.onemedical.com",
        industry: "medical"
    }
];

async function checkExistingPlumbingAgent() {
    console.log('🔍 Checking for existing plumbing agent...\n');

    const plumbingAgentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

    const { data: agent } = await supabase
        .from('agents')
        .select('id, name, website_url')
        .eq('id', plumbingAgentId)
        .single();

    if (agent) {
        console.log(`✅ Found existing plumbing agent: ${agent.name}`);
        console.log(`   Website: ${agent.website_url}`);
        console.log(`   ID: ${agent.id}\n`);
        return { id: agent.id, name: 'Plumbing Agent', url: agent.website_url, industry: 'plumbing' };
    }

    return null;
}

async function createTestAgent(name, websiteUrl, industry) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 Creating agent: ${name}`);
    console.log(`📍 Website: ${websiteUrl}`);
    console.log(`🏢 Industry: ${industry}`);
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
            return { id: existingKB.agent_id, name: existingKB.agents.name, url: websiteUrl, industry };
        }

        // Get first user for agent ownership
        const { data: users } = await supabase
            .from('users')
            .select('id')
            .limit(1);

        const userId = users && users.length > 0 ? users[0].id : '00000000-0000-0000-0000-000000000000';

        // Create new agent
        const agentId = uuidv4();
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .insert({
                id: agentId,
                user_id: userId,
                name: name,
                website_url: websiteUrl,
                face_id: 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427',
                voice_id: '1b160c4cf02e4855a09efd59475b9370',
                status: 'active',
                crawl_status: 'pending'
            })
            .select()
            .single();

        if (agentError) {
            console.error(`❌ Error creating agent:`, agentError);
            return null;
        }

        console.log(`✅ Created agent: ${agent.name} (${agent.id})`);

        // Crawl and store website using backend API
        console.log(`\n🕷️  Crawling website: ${websiteUrl}`);
        console.log(`   This may take 1-2 minutes...`);

        const crawlResponse = await fetch('http://localhost:8080/api/crawl-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: agent.id,
                websiteUrl: websiteUrl
            })
        });

        if (!crawlResponse.ok) {
            const error = await crawlResponse.json();
            throw new Error(`Crawl failed: ${JSON.stringify(error)}`);
        }

        const crawlData = await crawlResponse.json();
        console.log(`✅ Crawl complete: ${crawlData.pagesCount} pages, ${crawlData.chunksStored} chunks`);

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

        return { id: agent.id, name: agent.name, url: websiteUrl, industry };

    } catch (error) {
        console.error(`❌ Error setting up agent:`, error.message);
        return null;
    }
}

async function verifyEmbeddings(agents) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Final Embedding Coverage Verification`);
    console.log(`${'='.repeat(80)}\n`);

    let totalAgents = 0;
    let readyAgents = 0;

    for (const agent of agents) {
        totalAgents++;

        // Get knowledge base
        const { data: kb } = await supabase
            .from('knowledge_bases')
            .select('id, status')
            .eq('agent_id', agent.id)
            .single();

        if (!kb) {
            console.log(`⚠️  ${agent.name}: No knowledge base found`);
            continue;
        }

        // Count total chunks
        const { count: totalChunks } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('kb_id', kb.id);

        // Count chunks with embeddings
        const { count: withEmbeddings } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('kb_id', kb.id)
            .not('embedding', 'is', null);

        const coverage = totalChunks > 0 ? ((withEmbeddings / totalChunks) * 100).toFixed(1) : 0;
        const status = withEmbeddings === totalChunks && totalChunks > 0 ? '✅' : '⚠️';

        if (withEmbeddings === totalChunks && totalChunks > 0) {
            readyAgents++;
        }

        console.log(`${status} ${agent.name}`);
        console.log(`   KB Status: ${kb.status}`);
        console.log(`   Total Chunks: ${totalChunks || 0}`);
        console.log(`   With Embeddings: ${withEmbeddings || 0} (${coverage}%)`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Summary: ${readyAgents}/${totalAgents} agents ready for testing`);
    console.log(`${'='.repeat(80)}\n`);
}

async function setupMultipleAgents() {
    console.log('🚀 Setting Up 10 Test Agents for Multi-Agent RAG Testing\n');

    const createdAgents = [];

    // Step 1: Check for existing plumbing agent
    const existingPlumbing = await checkExistingPlumbingAgent();
    if (existingPlumbing) {
        createdAgents.push(existingPlumbing);
    }

    // Step 2: Create remaining agents to reach 10 total
    const remainingCount = 10 - createdAgents.length;
    console.log(`\n📝 Creating ${remainingCount} new agents...\n`);

    for (let i = 0; i < Math.min(remainingCount, testWebsites.length); i++) {
        const website = testWebsites[i];
        const agent = await createTestAgent(website.name, website.url, website.industry);

        if (agent) {
            createdAgents.push(agent);
        }

        // Wait 2 seconds between crawls to avoid rate limiting
        if (i < remainingCount - 1) {
            console.log(`\n⏳ Waiting 2 seconds before next crawl...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Setup Complete!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\nCreated ${createdAgents.length} agents:`);
    createdAgents.forEach((agent, idx) => {
        console.log(`   ${idx + 1}. ${agent.name} (${agent.industry}) - ${agent.id}`);
    });

    // Verify embeddings
    await verifyEmbeddings(createdAgents);

    console.log(`\n💡 You can now run: node test-multi-agent-rag.js`);
    console.log(`💡 Or run comprehensive test: node test-comprehensive-multi-agent.js\n`);
}

setupMultipleAgents().catch(console.error);
