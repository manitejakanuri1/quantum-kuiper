const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Key:', supabaseAnonKey ? 'Found' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function list() {
    console.log('Fetching agents...');
    const { data, error } = await supabase.from('agents').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Agents found:', data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

list();
