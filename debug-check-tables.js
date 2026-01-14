const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
    console.log('Checking database connection...');

    // Try to select from 'agents' table
    const { data, error } = await supabase.from('agents').select('count', { count: 'exact', head: true });

    if (error) {
        if (error.code === '42P01') { // PostgreSQL code for "undefined_table"
            console.log('❌ CRITICAL: Tables do NOT exist.');
            console.log('The SQL query probably wasn\'t run successfully.');
        } else {
            console.log('❌ Error connecting to database:', error.message);
        }
    } else {
        console.log('✅ SUCCESS: Tables exist!');
        console.log('The "agents" table was found.');
    }
}

checkTables();
