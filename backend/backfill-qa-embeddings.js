/**
 * Backfill embeddings for existing Q&A pairs
 * Run this ONCE after adding question_embedding column to qa_pairs table
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { generateEmbedding } = require('./lib/retrieval');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillEmbeddings() {
    console.log('🔄 Starting Q&A Embeddings Backfill...\n');
    console.log('='.repeat(80));

    try {
        // Step 1: Get all Q&A pairs without embeddings
        const { data: qaPairs, error: fetchError } = await supabase
            .from('qa_pairs')
            .select('*')
            .is('question_embedding', null);

        if (fetchError) throw fetchError;

        if (!qaPairs || qaPairs.length === 0) {
            console.log('✅ No Q&A pairs need backfilling. All embeddings are up to date!');
            return;
        }

        console.log(`📊 Found ${qaPairs.length} Q&A pairs without embeddings`);
        console.log('='.repeat(80));

        // Step 2: Generate embeddings and update database
        let successCount = 0;
        let errorCount = 0;

        for (const qa of qaPairs) {
            try {
                console.log(`\n🔍 Processing Q&A ID: ${qa.id}`);
                console.log(`   Question: "${qa.question.substring(0, 80)}..."`);

                // Generate embedding at write-time
                const embedding = await generateEmbedding(qa.question);

                // Update database
                const { error: updateError } = await supabase
                    .from('qa_pairs')
                    .update({ question_embedding: embedding })
                    .eq('id', qa.id);

                if (updateError) {
                    console.error(`   ❌ Failed:`, updateError.message);
                    errorCount++;
                } else {
                    console.log(`   ✅ Embedding generated and saved`);
                    successCount++;
                }
            } catch (error) {
                console.error(`   ❌ Error:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📈 BACKFILL COMPLETE');
        console.log('='.repeat(80));
        console.log(`✅ Success: ${successCount}/${qaPairs.length} Q&A pairs`);
        console.log(`❌ Errors:  ${errorCount}/${qaPairs.length} Q&A pairs`);
        console.log('='.repeat(80));

        if (successCount === qaPairs.length) {
            console.log('\n🎉 All Q&A pairs now have precomputed embeddings!');
            console.log('🚀 Your system is now scale-safe and ready for production.');
        } else {
            console.log('\n⚠️ Some Q&A pairs failed to backfill. Please review errors above.');
        }

    } catch (error) {
        console.error('\n❌ Backfill failed:', error);
        process.exit(1);
    }
}

// Run backfill
backfillEmbeddings()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
