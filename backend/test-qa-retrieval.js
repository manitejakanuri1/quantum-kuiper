/**
 * Test Q&A Pairs Retrieval with 3-Tier Strategy
 * Tests: Q&A Exact Match → Q&A Semantic Match → Vector Search → Fallback
 */

require('dotenv').config({ path: '../.env.local' });
const { retrieveAnswer } = require('./lib/retrieval');

const agentId = 'b1a1ad41-ca6a-4f21-9d58-0bcd62a58db1'; // Sites by Sara

const testQueries = [
    {
        query: "What services does Sara offer?",
        expectedSource: "qa_exact or qa_semantic",
        description: "Should match Q&A pair if exists"
    },
    {
        query: "Tell me about yourself",
        expectedSource: "qa_exact or qa_semantic",
        description: "Should match Q&A pair if exists"
    },
    {
        query: "What kind of websites do you build?",
        expectedSource: "qa_exact or qa_semantic or vector_search",
        description: "May match Q&A or fall through to vector search"
    },
    {
        query: "What's your favorite color?",
        expectedSource: "fallback",
        description: "Should not match any Q&A or content, return fallback"
    },
    {
        query: "How can I contact you?",
        expectedSource: "qa_exact or qa_semantic or vector_search",
        description: "Should find contact information"
    }
];

async function testQARetrieval() {
    console.log('🧪 Testing 3-Tier RAG Retrieval (Q&A → Vector → Fallback)\\n');
    console.log('='.repeat(80));
    console.log(`Agent ID: ${agentId}`);
    console.log(`Agent: Sites by Sara`);
    console.log(`Website: https://sitesbysara.com/`);
    console.log('='.repeat(80));

    let testResults = {
        qa_exact: 0,
        qa_semantic: 0,
        vector_search: 0,
        fallback: 0,
        error: 0
    };

    for (const testCase of testQueries) {
        console.log(`\\n${'─'.repeat(80)}`);
        console.log(`📝 Query: "${testCase.query}"`);
        console.log(`   Expected: ${testCase.expectedSource}`);
        console.log(`   Description: ${testCase.description}`);
        console.log(`${'─'.repeat(80)}`);

        try {
            const result = await retrieveAnswer(agentId, testCase.query);

            console.log(`\\n✅ Result:`);
            console.log(`   Source: ${result.source || 'unknown'}`);
            console.log(`   Success: ${result.success}`);
            console.log(`   Confidence: ${result.confidence?.toFixed(1) || 0}%`);
            console.log(`   Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);
            console.log(`   Answer: ${result.answer?.substring(0, 200)}${result.answer?.length > 200 ? '...' : ''}`);

            // Track source counts
            if (result.source && testResults[result.source] !== undefined) {
                testResults[result.source]++;
            }

        } catch (error) {
            console.error(`\\n❌ Error:`, error.message);
            testResults.error++;
        }
    }

    console.log(`\\n${'='.repeat(80)}`);
    console.log('📊 RETRIEVAL SOURCE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Q&A Exact Matches:    ${testResults.qa_exact}`);
    console.log(`Q&A Semantic Matches: ${testResults.qa_semantic}`);
    console.log(`Vector Search:        ${testResults.vector_search}`);
    console.log(`Fallback:             ${testResults.fallback}`);
    console.log(`Errors:               ${testResults.error}`);
    console.log('='.repeat(80));

    console.log(`\\n✅ Q&A Retrieval Test Complete!`);
    console.log(`\\n💡 Next Steps:`);
    console.log(`   1. Check Supabase to verify user_questions logged with answer_source`);
    console.log(`   2. Add Q&A pairs in admin panel if you want more Q&A matches`);
    console.log(`   3. Query user_questions table to see answer source distribution`);
    console.log('='.repeat(80));
}

// Run the test
testQARetrieval().catch(console.error);
