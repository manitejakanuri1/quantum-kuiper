// Test RAG retrieval
require('dotenv').config({ path: '../.env.local' });
const { retrieveAnswer } = require('./lib/retrieval');

async function testRAG() {
    const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

    const testQueries = [
        "Tell me about yourself",
        "What services do you offer?",
        "What are your prices?",
        "When are you open?",
        "Do you do emergency plumbing?"
    ];

    console.log(`\n🧪 Testing RAG Retrieval for agent: ${agentId}\n`);
    console.log('=' .repeat(80));

    for (const query of testQueries) {
        console.log(`\n📝 Query: "${query}"`);
        console.log('-'.repeat(80));

        try {
            const result = await retrieveAnswer(agentId, query);

            console.log(`✅ Success: ${result.success}`);
            console.log(`📊 Confidence: ${result.confidence}%`);
            console.log(`🎯 Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);
            console.log(`📖 Answer: ${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}`);
            if (result.sourceUrl) {
                console.log(`🔗 Source: ${result.sourceUrl}`);
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }

        console.log('=' .repeat(80));
    }

    console.log('\n✅ RAG Testing Complete!\n');
}

testRAG().catch(console.error);
