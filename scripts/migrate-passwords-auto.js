/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Automatically migrate plaintext passwords to bcrypt hashed passwords
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

async function migratePasswords() {
    console.log('=== Automatic Password Migration ===\n');

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
            return;
        }

        // Filter users with plaintext passwords
        const plaintextUsers = users.filter(u =>
            !u.password.startsWith('$2a$') &&
            !u.password.startsWith('$2b$')
        );

        if (plaintextUsers.length === 0) {
            console.log('✅ All passwords are already bcrypt hashed. No migration needed.');
            return;
        }

        console.log(`Found ${plaintextUsers.length} user(s) with plaintext passwords\n`);
        console.log('🔄 Migrating passwords...\n');

        let successCount = 0;
        let errorCount = 0;

        for (const user of plaintextUsers) {
            try {
                // Hash the plaintext password
                console.log(`Processing: ${user.email}...`);
                const hashedPassword = await bcrypt.hash(user.password, 10);

                // Update in database
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ password: hashedPassword })
                    .eq('id', user.id);

                if (updateError) {
                    console.error(`❌ Failed: ${user.email} - ${updateError.message}`);
                    errorCount++;
                } else {
                    console.log(`✅ Migrated: ${user.email}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`❌ Error: ${user.email} - ${err.message}`);
                errorCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Successfully migrated: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📝 Total processed: ${plaintextUsers.length}`);

        if (successCount > 0) {
            console.log('\n✅ Migration complete!');
            console.log('ℹ️  Users can now login with their EXISTING passwords.');
            console.log('ℹ️  The passwords are now securely hashed with bcrypt.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

migratePasswords();
