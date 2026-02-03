/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Migrate plaintext passwords to bcrypt hashed passwords
 * WARNING: This will update all non-bcrypt passwords in the database
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function migratePasswords() {
    console.log('=== Password Migration Tool ===\n');
    console.log('⚠️  This will convert all plaintext passwords to bcrypt hashes.');
    console.log('⚠️  Users with plaintext passwords will need to use their CURRENT password to login.\n');

    try {
        // Get all users
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, password');

        if (error) {
            console.error('❌ Database error:', error.message);
            return;
        }

        if (!users || users.length === 0) {
            console.log('ℹ️  No users found in database');
            rl.close();
            return;
        }

        // Filter users with plaintext passwords
        const plaintextUsers = users.filter(u =>
            !u.password.startsWith('$2a$') &&
            !u.password.startsWith('$2b$')
        );

        if (plaintextUsers.length === 0) {
            console.log('✅ All passwords are already bcrypt hashed. No migration needed.');
            rl.close();
            return;
        }

        console.log(`Found ${plaintextUsers.length} user(s) with plaintext passwords:\n`);
        plaintextUsers.forEach((u, i) => {
            console.log(`${i + 1}. ${u.email}`);
        });

        const confirm = await ask('\n⚠️  Proceed with migration? (yes/no): ');

        if (confirm.toLowerCase() !== 'yes') {
            console.log('❌ Migration cancelled.');
            rl.close();
            return;
        }

        console.log('\n🔄 Migrating passwords...\n');

        let successCount = 0;
        let errorCount = 0;

        for (const user of plaintextUsers) {
            try {
                // Hash the plaintext password
                const hashedPassword = await bcrypt.hash(user.password, 10);

                // Update in database
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ password: hashedPassword })
                    .eq('id', user.id);

                if (updateError) {
                    console.error(`❌ Failed to update ${user.email}:`, updateError.message);
                    errorCount++;
                } else {
                    console.log(`✅ Migrated: ${user.email}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`❌ Error processing ${user.email}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Successfully migrated: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📝 Total processed: ${plaintextUsers.length}`);

        if (successCount > 0) {
            console.log('\n✅ Migration complete! Users can now login with their existing passwords.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        rl.close();
    }
}

migratePasswords();
