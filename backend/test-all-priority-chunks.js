// Test all priority 100 chunks
require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { generateEmbedding } = require('./lib/retrieval');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAllPriorityChunks() {
    const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

    console.log(`\n🧪 Testing All Priority 100 Chunks\n`);

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

    // 2. Get all priority 100 chunks
    const { data: priorityChunks, error } = await supabase
        .from('document_chunks')
        .select('*')
        .eq('kb_id', kb.id)
        .eq('priority', 100)
        .order('created_at', { ascending: false });

    if (error || !priorityChunks || priorityChunks.length === 0) {
        console.error('❌ No priority 100 chunks found');
        console.error('Error:', error?.message);
        return;
    }

    console.log(`✅ Found ${priorityChunks.length} chunks with priority 100:\n`);

    // 3. Test similarity for each chunk
    const query = "Tell me about yourself";
    console.log(`🔍 Testing similarity with: "${query}"\n`);

    const queryEmbedding = await generateEmbedding(query);

    for (let i = 0; i < priorityChunks.length; i++) {
        const chunk = priorityChunks[i];

        console.log(`\n═══════════════ Chunk ${i + 1} ═══════════════`);
        console.log(`ID: ${chunk.id}`);
        console.log(`Created: ${new Date(chunk.created_at).toLocaleString()}`);
        console.log(`Content: ${chunk.content.substring(0, 150)}...`);
        console.log(`Full Length: ${chunk.content.length} chars`);
        console.log(`Has Embedding: ${chunk.embedding ? 'Yes' : 'No'}`);

        if (chunk.embedding) {
            // Call RPC to test similarity
            const { data: result } = await supabase
                .rpc('match_agent_knowledge', {
                    query_embedding: queryEmbedding,
                    match_agent_id: agentId,
                    match_threshold: 0.0,
                    match_count: 100
                });

            const match = result?.find(r => r.id === chunk.id);
            if (match) {
                console.log(`Similarity: ${(match.similarity * 100).toFixed(2)}%`);
                console.log(`Priority in RPC: ${match.priority}`);
            } else {
                console.log(`⚠️ Not found in RPC results`);
            }
        }
    }

    // 4. Recommendation
    console.log(`\n\n📊 Summary:\n`);
    console.log(`Total Priority 100 Chunks: ${priorityChunks.length}`);

    if (priorityChunks.length > 1) {
        console.log(`\n⚠️ ISSUE: Multiple self-description chunks exist!`);
        console.log(`Recommendation: Delete older chunks, keep only the newest one.`);
        console.log(`\nTo delete old chunks, run:`);
        priorityChunks.slice(1).forEach(chunk => {
            console.log(`  DELETE FROM document_chunks WHERE id = '${chunk.id}';`);
        });
    }
}

testAllPriorityChunks().catch(console.error);
