// Delete old self-description chunks
require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteOldSelfDescriptions() {
    const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

    // Get knowledge base
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

    // Delete ALL priority 100 chunks (self-descriptions)
    const { data, error } = await supabase
        .from('document_chunks')
        .delete()
        .eq('kb_id', kb.id)
        .eq('priority', 100)
        .select();

    if (error) {
        console.error('❌ Error deleting chunks:', error.message);
        return;
    }

    console.log(`✅ Deleted ${data.length} old self-description chunks`);
    data.forEach((chunk, i) => {
        console.log(`   ${i + 1}. ID: ${chunk.id}, Created: ${new Date(chunk.created_at).toLocaleString()}`);
    });

    console.log(`\n✅ Ready for re-crawl to generate new self-description`);
}

deleteOldSelfDescriptions().catch(console.error);
