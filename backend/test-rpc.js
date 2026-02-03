// Test match_agent_knowledge RPC function directly
require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { generateEmbedding } = require('./lib/retrieval');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRPC() {
    const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';
    const query = "Tell me about yourself";

    console.log(`\n🧪 Testing match_agent_knowledge RPC\n`);
    console.log(`Query: "${query}"`);
    console.log(`Agent ID: ${agentId}\n`);

    // Generate embedding for query
    console.log('📦 Generating query embedding...');
    const embedding = await generateEmbedding(query);
    console.log(`✅ Embedding generated (${embedding.length} dimensions)\n`);

    // Test RPC call
    console.log('🔍 Calling match_agent_knowledge RPC...');
    const { data, error } = await supabase
        .rpc('match_agent_knowledge', {
            query_embedding: embedding,
            match_agent_id: agentId,
            match_threshold: 0.1,  // Very low threshold for testing
            match_count: 5
        });

    if (error) {
        console.error('❌ RPC Error:', error);
        console.error('   Message:', error.message);
        console.error('   Code:', error.code);
        console.error('   Details:', error.details);
        console.error('   Hint:', error.hint);
        return;
    }

    console.log(`✅ RPC call successful`);
    console.log(`📊 Results: ${data ? data.length : 0} matches\n`);

    if (data && data.length > 0) {
        console.log('📝 Top Matches:');
        data.forEach((match, i) => {
            console.log(`\n${i + 1}. Similarity: ${(match.similarity * 100).toFixed(1)}%`);
            console.log(`   Source: ${match.source || 'N/A'}`);
            console.log(`   Content: ${match.chunk_text.substring(0, 150)}...`);
        });
    } else {
        console.log('⚠️ No matches found even with threshold 0.1');
    }
}

testRPC().catch(console.error);
