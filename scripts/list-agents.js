require('dotenv').config({path: './.env.local'});
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
        .from('agents')
        .select('id, name, website_url')
        .limit(10);

    if (error) {
        console.log('❌ Error:', error.message);
        process.exit(1);
    }

    if (!data || data.length === 0) {
        console.log('⚠️ No agents found in database');
        console.log('💡 Create an agent first at: http://localhost:3000/create');
        process.exit(0);
    }

    console.log('📋 Available agents:');
    console.log('');
    data.forEach(agent => {
        console.log(`  Agent ID: ${agent.id}`);
        console.log(`  Name: ${agent.name}`);
        console.log(`  Website: ${agent.website_url || 'Not set'}`);
        console.log('');
    });

    console.log('💡 To crawl a website for an agent, run:');
    console.log('   node scripts/crawl-website.js <website-url> <agent-id>');
}

main().catch(console.error);
