// Test if self-description chunk exists and can be retrieved
require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { generateEmbedding } = require('./lib/retrieval');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSelfDescription() {
    const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

    console.log(`\n🧪 Testing Self-Description Chunk\n`);

    // 1. Find the knowledge base
    const { data: kb } = await supabase
        .from('knowledge_bases')
        .select('id')
        .eq('agent_id', agentId)
        .single();

    if (!kb) {
        console.error('❌ No knowledge base found');
        return;
    }

    console.log(`📚 Knowledge Base ID: ${kb.id}\n`);

    // 2. Get self-description chunk
    const { data: selfDesc, error } = await supabase
        .from('document_chunks')
        .select('*')
        .eq('kb_id', kb.id)
        .eq('priority', 100)
        .single();

    if (error || !selfDesc) {
        console.error('❌ No self-description chunk found with priority 100');
        console.error('Error:', error?.message);

        // Check all chunks with priority
        const { data: priorityChunks } = await supabase
            .from('document_chunks')
            .select('priority, content')
            .eq('kb_id', kb.id)
            .not('priority', 'is', null)
            .order('priority', { ascending: false })
            .limit(5);

        if (priorityChunks && priorityChunks.length > 0) {
            console.log('\n📝 Chunks with priority:');
            priorityChunks.forEach(c => {
                console.log(`   Priority ${c.priority}: ${c.content.substring(0, 100)}...`);
            });
        } else {
            console.log('⚠️ No chunks with priority found at all');
        }
        return;
    }

    console.log('✅ Self-description chunk found!');
    console.log(`   Priority: ${selfDesc.priority}`);
    console.log(`   Content: ${selfDesc.content}\n`);
    console.log(`   Has Embedding: ${selfDesc.embedding ? 'Yes' : 'No'}\n`);

    if (!selfDesc.embedding) {
        console.error('❌ Self-description has NO embedding!');
        return;
    }

    // 3. Test similarity with "tell me about yourself" query
    console.log('🔍 Testing similarity with "Tell me about yourself"...\n');

    const query = "Tell me about yourself";
    const queryEmbedding = await generateEmbedding(query);

    // Calculate cosine similarity manually
    const { data: result } = await supabase
        .rpc('match_agent_knowledge', {
            query_embedding: queryEmbedding,
            match_agent_id: agentId,
            match_threshold: 0.0,  // No threshold
            match_count: 50
        });

    if (result) {
        const selfDescMatch = result.find(r => r.id === selfDesc.id);
        if (selfDescMatch) {
            console.log(`✅ Self-description found in results!`);
            console.log(`   Similarity: ${(selfDescMatch.similarity * 100).toFixed(1)}%`);
            console.log(`   Rank: ${result.indexOf(selfDescMatch) + 1} out of ${result.length}`);
        } else {
            console.log('❌ Self-description NOT in results');
            console.log(`   Total results: ${result.length}`);
            console.log('\n📊 Top 5 results:');
            result.slice(0, 5).forEach((r, i) => {
                console.log(`   ${i + 1}. Similarity: ${(r.similarity * 100).toFixed(1)}%`);
                console.log(`      Content: ${r.chunk_text.substring(0, 80)}...`);
            });
        }
    }
}

testSelfDescription().catch(console.error);
