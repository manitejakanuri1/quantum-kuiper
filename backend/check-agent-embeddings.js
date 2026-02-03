/**
 * Check which agents have embeddings vs just chunks
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgentEmbeddings() {
    console.log('🔍 Checking agents and their embedding status...\n');

    // Get all agents with knowledge bases
    const { data: agents, error } = await supabase
        .from('agents')
        .select(`
            id,
            name,
            knowledge_bases (
                id,
                source_url,
                status
            )
        `)
        .limit(10);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log(`Found ${agents.length} agents\n`);
    console.log('='.repeat(100));

    for (const agent of agents) {
        if (!agent.knowledge_bases || agent.knowledge_bases.length === 0) {
            console.log(`\n⚠️  Agent: ${agent.name} (${agent.id})`);
            console.log(`   Status: No knowledge base`);
            continue;
        }

        const kb = agent.knowledge_bases[0];

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

        // Count priority chunks (self-description)
        const { count: priorityChunks } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('kb_id', kb.id)
            .eq('priority', 100);

        const embeddingPercent = totalChunks > 0 ? (withEmbeddings / totalChunks * 100).toFixed(1) : 0;
        const status = withEmbeddings === totalChunks ? '✅' : withEmbeddings > 0 ? '⚠️' : '❌';

        console.log(`\n${status} Agent: ${agent.name} (${agent.id})`);
        console.log(`   Website: ${kb.source_url}`);
        console.log(`   KB Status: ${kb.status}`);
        console.log(`   Total Chunks: ${totalChunks || 0}`);
        console.log(`   With Embeddings: ${withEmbeddings || 0} (${embeddingPercent}%)`);
        console.log(`   Priority Chunks: ${priorityChunks || 0}`);

        if (totalChunks > 0 && withEmbeddings === 0) {
            console.log(`   ⚠️  WARNING: Chunks exist but no embeddings! Need to re-crawl or run embedding generation.`);
        }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n💡 Agents with 100% embeddings are ready for RAG testing');
    console.log('💡 Agents without embeddings need to be re-crawled to generate embeddings');
}

checkAgentEmbeddings().catch(console.error);
