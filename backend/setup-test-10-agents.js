/**
 * Setup 10 test agents with different websites for multi-agent testing
 * This script creates agents which automatically trigger website crawling
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

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
        // Call the Next.js API endpoint to create agent (will auto-trigger crawling)
        const response = await fetch('http://localhost:3000/api/agents/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                websiteUrl: websiteUrl,
                faceId: 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427', // Default face
                industry: industry
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ ${name} created - ID: ${data.agent.id}`);
            console.log(`   Crawl triggered: ${data.crawlTriggered ? 'YES' : 'NO'}`);
            console.log(`   Message: ${data.message}\n`);
            return { ...data.agent, industry };
        } else {
            const error = await response.json();
            console.error(`❌ Failed to create ${name}:`, error);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error creating ${name}:`, error.message);
        return null;
    }
}

async function waitForCrawlingComplete(agents) {
    console.log(`\n⏳ Waiting for all agents to finish crawling...`);
    console.log(`   This may take 1-2 minutes per agent (max 2 minutes total)\n`);

    const maxWaitTime = 120000; // 2 minutes max
    const pollInterval = 5000; // Check every 5 seconds
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
        // Get status for all agents
        const { data: agentStatuses } = await supabase
            .from('agents')
            .select('id, name, crawl_status, pages_crawled')
            .in('id', agents.map(a => a.id));

        // Count statuses
        const completed = agentStatuses?.filter(s => s.crawl_status === 'completed').length || 0;
        const crawling = agentStatuses?.filter(s => s.crawl_status === 'crawling').length || 0;
        const failed = agentStatuses?.filter(s => s.crawl_status === 'failed').length || 0;
        const active = agentStatuses?.filter(s => s.crawl_status === 'active').length || 0;

        console.log(`Status: ${completed} completed, ${crawling} crawling, ${active} active, ${failed} failed`);

        // Check if all completed or failed
        if (completed + failed >= agents.length) {
            console.log(`\n✅ All agents finished!`);
            console.log(`   Completed: ${completed}`);
            console.log(`   Failed: ${failed}\n`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;
    }

    if (elapsed >= maxWaitTime) {
        console.log(`\n⚠️  Timeout reached (2 minutes). Some agents may still be crawling.\n`);
    }
}

async function verifyEmbeddings(agents) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Verifying Embedding Coverage`);
    console.log(`${'='.repeat(80)}\n`);

    for (const agent of agents) {
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

        console.log(`${status} ${agent.name}`);
        console.log(`   KB Status: ${kb.status}`);
        console.log(`   Total Chunks: ${totalChunks || 0}`);
        console.log(`   With Embeddings: ${withEmbeddings || 0} (${coverage}%)`);
    }

    console.log(`\n${'='.repeat(80)}\n`);
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

        // Wait 2 seconds between creates to avoid rate limiting
        if (i < remainingCount - 1) {
            console.log(`⏳ Waiting 2 seconds before next agent...`);
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

    // Step 3: Wait for all crawls to complete
    await waitForCrawlingComplete(createdAgents);

    // Step 4: Verify embeddings
    await verifyEmbeddings(createdAgents);

    console.log(`\n💡 You can now run: node test-multi-agent-rag.js`);
}

setupMultipleAgents().catch(console.error);
