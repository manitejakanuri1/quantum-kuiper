// One-time password migration script
// Converts plaintext passwords to bcrypt hashes
require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not configured!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePasswords() {
    console.log('🔄 Starting password migration...\n');

    // Get all users
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, password');

    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }

    if (!users || users.length === 0) {
        console.log('ℹ️ No users found in database.');
        return;
    }

    console.log(`Found ${users.length} users to check\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
        // Check if password is already a bcrypt hash
        // bcrypt hashes start with $2a$, $2b$, or $2y$
        if (user.password.match(/^\$2[aby]\$\d{2}\$/)) {
            console.log(`⏭️  Skipped ${user.email} - already hashed`);
            skippedCount++;
            continue;
        }

        // Hash the plaintext password
        console.log(`🔐 Hashing password for: ${user.email}`);
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // Update in database
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', user.id);

        if (updateError) {
            console.error(`❌ Error updating ${user.email}:`, updateError);
        } else {
            console.log(`✅ Migrated ${user.email}`);
            migratedCount++;
        }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📋 Total: ${users.length}`);
    console.log('\n✅ Password migration complete!');
}

// Safety confirmation
console.log('⚠️  WARNING: This will modify passwords in your database!');
console.log('This script should only be run ONCE.\n');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
    migratePasswords().catch(console.error);
}, 5000);
