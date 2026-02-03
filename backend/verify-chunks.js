// Verify chunks stored in database
require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyChunks() {
    const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

    console.log(`\n🔍 Verifying chunks for agent: ${agentId}\n`);

    // 1. Check knowledge base
    const { data: kb, error: kbError } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    if (kbError) {
        console.error('❌ Error fetching knowledge base:', kbError.message);
        return;
    }

    console.log('📚 Knowledge Base:');
    console.log(`   ID: ${kb.id}`);
    console.log(`   Status: ${kb.status}`);
    console.log(`   Source: ${kb.source_url}`);
    console.log(`   Created: ${new Date(kb.created_at).toLocaleString()}\n`);

    // 2. Count chunks with embeddings
    const { data: chunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select('id, embedding, content, source, priority')
        .eq('kb_id', kb.id);

    if (chunksError) {
        console.error('❌ Error fetching chunks:', chunksError.message);
        return;
    }

    const totalChunks = chunks.length;
    const chunksWithEmbeddings = chunks.filter(c => c.embedding !== null).length;
    const coverage = ((chunksWithEmbeddings / totalChunks) * 100).toFixed(1);

    console.log('📊 Chunks Statistics:');
    console.log(`   Total Chunks: ${totalChunks}`);
    console.log(`   With Embeddings: ${chunksWithEmbeddings}`);
    console.log(`   Coverage: ${coverage}%\n`);

    // 3. Show self-description chunk
    const selfDesc = chunks.find(c => c.priority === 100);
    if (selfDesc) {
        console.log('✨ Self-Description Chunk:');
        console.log(`   Priority: ${selfDesc.priority}`);
        console.log(`   Content: ${selfDesc.content.substring(0, 200)}...\n`);
    }

    // 4. Show sample chunks
    console.log('📝 Sample Chunks (first 3):');
    chunks.slice(0, 3).forEach((chunk, i) => {
        console.log(`   ${i + 1}. Source: ${chunk.source}`);
        console.log(`      Content: ${chunk.content.substring(0, 100)}...`);
        console.log(`      Has Embedding: ${chunk.embedding !== null ? '✅' : '❌'}\n`);
    });

    if (totalChunks > 0 && chunksWithEmbeddings === totalChunks && kb.status === 'ready') {
        console.log('✅ RAG System is READY! All chunks have embeddings.\n');
    } else {
        console.log('⚠️ Issues detected. Check the status above.\n');
    }
}

verifyChunks().catch(console.error);
