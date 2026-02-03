/**
 * Test RAG retrieval for sitesbysara.com agent
 */

require('dotenv').config({ path: '../.env.local' });
const { retrieveAnswer } = require('./lib/retrieval');

const agentId = 'b1a1ad41-ca6a-4f21-9d58-0bcd62a58db1';

const testQueries = [
    "What services does Sara offer?",
    "Tell me about yourself",
    "What kind of websites do you build?",
    "How can I contact you?",
    "What is your expertise?"
];

async function testRetrieval() {
    console.log('🧪 Testing RAG Retrieval for Sites by Sara Agent\n');
    console.log('='.repeat(80));
    console.log(`Agent ID: ${agentId}`);
    console.log(`Website: https://sitesbysara.com/`);
    console.log('='.repeat(80));

    for (const query of testQueries) {
        console.log(`\n📝 Query: "${query}"`);
        console.log('-'.repeat(80));

        try {
            const result = await retrieveAnswer(agentId, query);

            console.log(`✅ Success: ${result.success}`);
            console.log(`📊 Confidence: ${result.confidence?.toFixed(1) || 0}%`);
            console.log(`🎯 Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);
            console.log(`💬 Answer: ${result.answer?.substring(0, 200)}...`);

        } catch (error) {
            console.error(`❌ Error:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ RAG Retrieval Test Complete!');
    console.log('='.repeat(80));
}

testRetrieval().catch(console.error);
