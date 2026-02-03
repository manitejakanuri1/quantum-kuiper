/**
 * Test single agent crawl to verify the storage fix
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCrawl() {
    console.log('🧪 Testing Website Crawl After Storage Fix\n');
    console.log('='.repeat(80));

    // Use a simple, fast website for testing
    const testWebsite = {
        name: "Test Coffee Shop Agent",
        url: "https://www.bluebottlecoffee.com"
    };

    const agentId = uuidv4();
    const userId = '26128add-c536-4a92-a655-f790b9841ac3'; // Use existing user

    console.log(`\n📝 Creating test agent...`);
    console.log(`   Name: ${testWebsite.name}`);
    console.log(`   Website: ${testWebsite.url}`);
    console.log(`   Agent ID: ${agentId}`);

    // Create agent
    const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
            id: agentId,
            user_id: userId,
            name: testWebsite.name,
            website_url: testWebsite.url,
            face_id: 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427',
            voice_id: '1b160c4cf02e4855a09efd59475b9370',
            status: 'active',
            crawl_status: 'pending'
        })
        .select()
        .single();

    if (agentError) {
        console.error(`❌ Error creating agent:`, agentError);
        process.exit(1);
    }

    console.log(`✅ Agent created successfully\n`);

    // Crawl website
    console.log(`🕷️  Crawling website: ${testWebsite.url}`);
    console.log(`   This may take 1-2 minutes...\n`);

    try {
        const crawlResponse = await fetch('http://localhost:8080/api/crawl-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: agent.id,
                websiteUrl: testWebsite.url
            })
        });

        if (!crawlResponse.ok) {
            const error = await crawlResponse.json();
            console.error(`❌ Crawl failed with status ${crawlResponse.status}:`);
            console.error(JSON.stringify(error, null, 2));
            process.exit(1);
        }

        const crawlData = await crawlResponse.json();
        console.log(`✅ Crawl successful!`);
        console.log(`   Pages crawled: ${crawlData.pagesCount}`);
        console.log(`   Chunks stored: ${crawlData.chunksStored}\n`);

        // Verify chunks in database
        console.log(`🔍 Verifying chunks in database...`);

        const { data: kb } = await supabase
            .from('knowledge_bases')
            .select('id, status')
            .eq('agent_id', agent.id)
            .eq('source_url', testWebsite.url)
            .single();

        if (!kb) {
            console.error(`❌ No knowledge base found for agent`);
            process.exit(1);
        }

        console.log(`   Knowledge base ID: ${kb.id}`);
        console.log(`   Status: ${kb.status}`);

        const { data: chunks, error: chunksError } = await supabase
            .from('document_chunks')
            .select('id, embedding')
            .eq('kb_id', kb.id);

        if (chunksError) {
            console.error(`❌ Error fetching chunks:`, chunksError);
            process.exit(1);
        }

        console.log(`   Total chunks in DB: ${chunks.length}`);
        console.log(`   Chunks with embeddings: ${chunks.filter(c => c.embedding).length}\n`);

        // Summary
        console.log('='.repeat(80));
        console.log('📊 Test Results Summary');
        console.log('='.repeat(80));

        const success = crawlData.chunksStored > 0 && chunks.length === crawlData.chunksStored;

        if (success) {
            console.log('✅ SUCCESS: Storage fix is working!');
            console.log(`   - Chunks stored: ${crawlData.chunksStored}`);
            console.log(`   - Chunks in DB: ${chunks.length}`);
            console.log(`   - All chunks have embeddings: ${chunks.every(c => c.embedding) ? 'Yes' : 'No'}`);
            console.log(`\n🎉 The "Failed to store crawled content" issue is FIXED!`);
        } else {
            console.log('⚠️  ISSUE DETECTED:');
            console.log(`   - API reported: ${crawlData.chunksStored} chunks`);
            console.log(`   - Database contains: ${chunks.length} chunks`);
        }

        console.log('\n' + '='.repeat(80));
        console.log(`\n💡 To test this agent, run:`);
        console.log(`   node test-single-agent.js ${agentId}`);

    } catch (error) {
        console.error('❌ Crawl error:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

testCrawl().catch(console.error);
