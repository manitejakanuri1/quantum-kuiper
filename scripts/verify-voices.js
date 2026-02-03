/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Verify voice migration was successful
 * Check that all 5 voices are present with correct metadata
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Expected voices after migration
const EXPECTED_VOICES = [
    { id: '1b160c4cf02e4855a09efd59475b9370', name: 'Sophia - Professional', gender: 'female', style: 'professional' },
    { id: '76f7e17483084df6b0f1bcecb5fb13e9', name: 'Marcus - Confident', gender: 'male', style: 'confident' },
    { id: '34b01f00fd8f4e12a664d1e081c13312', name: 'David - Friendly', gender: 'male', style: 'friendly' },
    { id: 'ab9f86c943514589a52c00f55088e1ae', name: 'E Girl - Playful', gender: 'female', style: 'playful' },
    { id: '4a98f7c293ee44898705529cc8ccc7d6', name: 'Kawaii - Cute', gender: 'female', style: 'cute' }
];

// Voices that should NOT exist (placeholders)
const REMOVED_VOICES = [
    'default-female',
    'default-male',
    'warm-female',
    'confident-male',
    'empathetic-female',
    'energetic-male'
];

async function verifyMigration() {
    console.log('=== Voice Migration Verification ===\n');

    try {
        // Get all system voices
        const { data: voices, error } = await supabase
            .from('voices')
            .select('id, name, gender, style, is_custom')
            .eq('is_custom', false)
            .order('gender', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error('❌ Database error:', error.message);
            return;
        }

        console.log(`📊 Found ${voices.length} system voices\n`);

        // Check expected voices
        let allPresent = true;
        console.log('✅ Expected Voices:');
        for (const expected of EXPECTED_VOICES) {
            const found = voices.find(v => v.id === expected.id);
            if (found) {
                const match = found.name === expected.name &&
                    found.gender === expected.gender &&
                    found.style === expected.style;
                if (match) {
                    console.log(`  ✓ ${expected.name} (${expected.gender}, ${expected.style})`);
                } else {
                    console.log(`  ⚠️  ${expected.id} - Found but metadata mismatch`);
                    console.log(`     Expected: ${expected.name} | Found: ${found.name}`);
                    allPresent = false;
                }
            } else {
                console.log(`  ✗ ${expected.name} - MISSING`);
                allPresent = false;
            }
        }

        // Check removed voices
        console.log('\n🗑️  Removed Placeholder Voices:');
        let allRemoved = true;
        for (const removedId of REMOVED_VOICES) {
            const found = voices.find(v => v.id === removedId);
            if (found) {
                console.log(`  ✗ ${removedId} - STILL EXISTS (should be removed)`);
                allRemoved = false;
            } else {
                console.log(`  ✓ ${removedId} - Removed`);
            }
        }

        // Check for unexpected voices
        console.log('\n🔍 Unexpected Voices:');
        const expectedIds = EXPECTED_VOICES.map(v => v.id);
        const unexpected = voices.filter(v => !expectedIds.includes(v.id));
        if (unexpected.length > 0) {
            console.log(`  ⚠️  Found ${unexpected.length} unexpected voice(s):`);
            unexpected.forEach(v => {
                console.log(`     - ${v.name} (${v.id})`);
            });
        } else {
            console.log('  ✓ No unexpected voices');
        }

        // Summary
        console.log('\n' + '═'.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`  Total system voices: ${voices.length}`);
        console.log(`  Expected voices: ${EXPECTED_VOICES.length}`);
        console.log(`  All expected present: ${allPresent ? '✅ YES' : '❌ NO'}`);
        console.log(`  All placeholders removed: ${allRemoved ? '✅ YES' : '❌ NO'}`);
        console.log(`  Unexpected voices: ${unexpected.length === 0 ? '✅ NONE' : `⚠️  ${unexpected.length}`}`);

        if (allPresent && allRemoved && unexpected.length === 0) {
            console.log('\n✅ MIGRATION SUCCESSFUL! All voices are correctly configured.');
        } else {
            console.log('\n⚠️  MIGRATION INCOMPLETE - Please run the migration SQL script in Supabase SQL Editor.');
            console.log('   Script location: scripts/migrate-voices.sql');
        }

        // Check agents using old voice IDs
        console.log('\n' + '═'.repeat(60));
        console.log('🤖 Agent Voice Usage:');
        const { data: agents } = await supabase
            .from('agents')
            .select('id, name, voice_id');

        if (agents && agents.length > 0) {
            const voiceUsage = {};
            agents.forEach(agent => {
                if (!voiceUsage[agent.voice_id]) {
                    voiceUsage[agent.voice_id] = 0;
                }
                voiceUsage[agent.voice_id]++;
            });

            for (const [voiceId, count] of Object.entries(voiceUsage)) {
                const voice = voices.find(v => v.id === voiceId);
                const voiceName = voice ? voice.name : `Unknown (${voiceId})`;
                console.log(`  ${voiceName}: ${count} agent(s)`);

                // Check if any agents use deleted placeholder IDs
                if (REMOVED_VOICES.includes(voiceId)) {
                    console.log(`    ⚠️  ${count} agent(s) still using deleted placeholder voice!`);
                }
            }
        } else {
            console.log('  ℹ️  No agents created yet');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyMigration();
