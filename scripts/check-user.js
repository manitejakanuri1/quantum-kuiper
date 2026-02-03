/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Check user password format in database
 * Helps diagnose login issues after bcrypt migration
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    console.log('=== User Database Check ===\n');

    try {
        // Get all users
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, password, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Database error:', error.message);
            return;
        }

        if (!users || users.length === 0) {
            console.log('ℹ️  No users found in database');
            return;
        }

        console.log(`Found ${users.length} user(s):\n`);

        for (const user of users) {
            console.log(`📧 Email: ${user.email}`);
            console.log(`🆔 ID: ${user.id}`);
            console.log(`📅 Created: ${new Date(user.created_at).toLocaleString()}`);

            // Check if password is bcrypt hashed
            const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');

            if (isBcryptHash) {
                console.log(`✅ Password: bcrypt hashed (secure)`);
            } else {
                console.log(`⚠️  Password: plaintext or old format (INSECURE!)`);
                console.log(`   Password length: ${user.password.length} chars`);
            }
            console.log('─'.repeat(60));
        }

        console.log('\n📊 Summary:');
        const bcryptUsers = users.filter(u => u.password.startsWith('$2a$') || u.password.startsWith('$2b$'));
        const plaintextUsers = users.filter(u => !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$'));

        console.log(`✅ Bcrypt hashed: ${bcryptUsers.length}`);
        console.log(`⚠️  Plaintext/old: ${plaintextUsers.length}`);

        if (plaintextUsers.length > 0) {
            console.log('\n🔧 Solution:');
            console.log('Run the password migration script to hash existing passwords:');
            console.log('  node scripts/migrate-passwords.js');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkUsers();
