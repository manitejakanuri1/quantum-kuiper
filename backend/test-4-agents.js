/**
 * Test 4 agents with 100% embedding coverage
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { retrieveAnswer } = require('./lib/retrieval');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 4 agents with 100% embedding coverage
const testAgents = [
    { id: 'c77978d2-9761-415d-a3fc-ab957e015d18', name: 'OpenAI Docs Agent', url: 'https://platform.openai.com/docs/' },
    { id: 'b70fd02a-9360-45b5-9e29-5440eced2a64', name: 'Coffee Shop Agent', url: 'https://www.bluebottlecoffee.com' },
    { id: 'af27770f-a57d-46d9-841c-aaaf5d043cff', name: 'Restaurant Agent', url: 'https://www.sweetgreen.com' },
    { id: '5eef743c-5ca8-4b5f-98e4-9f016fc28ef2', name: 'Fitness Agent', url: 'https://www.orangetheory.com' }
];

// Universal test queries
const testQueries = [
    {
        query: "Tell me about yourself",
        category: "self-description",
        shouldSucceed: true,
        minConfidence: 30
    },
    {
        query: "What services do you offer?",
        category: "services",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        query: "Tell me about your company",
        category: "company-info",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        query: "How can you help me?",
        category: "assistance",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        query: "What is quantum physics?",
        category: "out-of-scope",
        shouldSucceed: false,
        minConfidence: 0
    }
];

async function testSingleAgent(agent, testQueries) {
    console.log('='.repeat(80));
    console.log(`🤖 Testing Agent: ${agent.name}`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Website: ${agent.url}`);
    console.log('='.repeat(80));

    let correctAnswers = 0;
    let correctRejections = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let totalTests = testQueries.length;

    const results = [];

    for (const testCase of testQueries) {
        console.log(`\n📝 Query: "${testCase.query}"`);
        console.log(`   Category: ${testCase.category}`);
        console.log(`   Should succeed: ${testCase.shouldSucceed}`);
        console.log('-'.repeat(80));

        try {
            const result = await retrieveAnswer(agent.id, testCase.query);

            console.log(`   ✅ Success: ${result.success}`);
            console.log(`   📊 Confidence: ${result.confidence?.toFixed(1) || 0}%`);
            console.log(`   🎯 Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);

            // Evaluate correctness
            let isCorrect = false;
            if (testCase.shouldSucceed) {
                if (result.success && result.confidence >= testCase.minConfidence) {
                    correctAnswers++;
                    isCorrect = true;
                    console.log(`   ✅ CORRECT: Answered with sufficient confidence`);
                } else if (result.success && result.confidence < testCase.minConfidence) {
                    falsePositives++;
                    console.log(`   ⚠️  LOW CONFIDENCE: Answered but below ${testCase.minConfidence}%`);
                } else {
                    falseNegatives++;
                    console.log(`   ❌ FALSE NEGATIVE: Should have answered but didn't`);
                }
            } else {
                if (!result.success) {
                    correctRejections++;
                    isCorrect = true;
                    console.log(`   ✅ CORRECT: Properly rejected out-of-scope query`);
                } else {
                    falsePositives++;
                    console.log(`   ❌ FALSE POSITIVE: Answered out-of-scope query`);
                }
            }

            console.log(`   📖 Answer: ${result.answer?.substring(0, 120)}...`);

            results.push({
                query: testCase.query,
                category: testCase.category,
                success: result.success,
                confidence: result.confidence || 0,
                similarity: result.similarity || 0,
                isCorrect,
                shouldSucceed: testCase.shouldSucceed
            });

        } catch (error) {
            console.error(`   ❌ Error testing query:`, error.message);
            falseNegatives++;
            results.push({
                query: testCase.query,
                category: testCase.category,
                success: false,
                confidence: 0,
                similarity: 0,
                isCorrect: false,
                shouldSucceed: testCase.shouldSucceed,
                error: error.message
            });
        }
    }

    // Calculate agent-specific metrics
    const accuracy = ((correctAnswers + correctRejections) / totalTests) * 100;
    const precision = correctAnswers / (correctAnswers + falsePositives) * 100 || 0;
    const recall = correctAnswers / (correctAnswers + falseNegatives) * 100 || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    console.log('\n' + '─'.repeat(80));
    console.log(`📊 Agent Performance Summary: ${agent.name}`);
    console.log('─'.repeat(80));
    console.log(`✅ Correct Answers: ${correctAnswers}/${testQueries.filter(t => t.shouldSucceed).length}`);
    console.log(`✅ Correct Rejections: ${correctRejections}/${testQueries.filter(t => !t.shouldSucceed).length}`);
    console.log(`❌ False Positives: ${falsePositives}`);
    console.log(`❌ False Negatives: ${falseNegatives}`);
    console.log(`\n📈 Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`📈 Precision: ${precision.toFixed(1)}%`);
    console.log(`📈 Recall: ${recall.toFixed(1)}%`);
    console.log(`📈 F1 Score: ${f1Score.toFixed(1)}%`);

    return {
        agentId: agent.id,
        agentName: agent.name,
        sourceUrl: agent.url,
        results,
        metrics: {
            accuracy,
            precision,
            recall,
            f1Score,
            correctAnswers,
            correctRejections,
            falsePositives,
            falseNegatives,
            totalTests
        }
    };
}

async function runMultiAgentTest() {
    console.log('🧪 Multi-Agent RAG System Test\n');
    console.log('Testing RAG improvements across 4 agents with 100% embedding coverage\n');

    const allAgentResults = [];

    // Test each agent
    for (const agent of testAgents) {
        const agentResult = await testSingleAgent(agent, testQueries);
        allAgentResults.push(agentResult);
        console.log('\n');
    }

    // Calculate overall system metrics
    console.log('\n');
    console.log('='.repeat(80));
    console.log('🌐 OVERALL SYSTEM PERFORMANCE');
    console.log('='.repeat(80));

    const totalAccuracy = allAgentResults.reduce((sum, r) => sum + r.metrics.accuracy, 0) / allAgentResults.length;
    const totalPrecision = allAgentResults.reduce((sum, r) => sum + r.metrics.precision, 0) / allAgentResults.length;
    const totalRecall = allAgentResults.reduce((sum, r) => sum + r.metrics.recall, 0) / allAgentResults.length;
    const totalF1 = allAgentResults.reduce((sum, r) => sum + r.metrics.f1Score, 0) / allAgentResults.length;

    console.log(`\n📊 Tested Agents: ${allAgentResults.length}`);
    console.log(`📊 Total Test Queries: ${allAgentResults.length * testQueries.length}`);
    console.log(`\n📈 Average Accuracy: ${totalAccuracy.toFixed(1)}%`);
    console.log(`📈 Average Precision: ${totalPrecision.toFixed(1)}%`);
    console.log(`📈 Average Recall: ${totalRecall.toFixed(1)}%`);
    console.log(`📈 Average F1 Score: ${totalF1.toFixed(1)}%`);

    console.log(`\n🎯 Target: 80%+ accuracy across all agents`);
    if (totalAccuracy >= 80) {
        console.log(`✅ TARGET ACHIEVED! (${totalAccuracy.toFixed(1)}% average accuracy)`);
    } else {
        console.log(`⚠️  Need ${(80 - totalAccuracy).toFixed(1)}% improvement`);
    }

    // Agent-by-agent breakdown
    console.log(`\n📊 Performance by Agent:`);
    console.log('─'.repeat(80));

    for (const result of allAgentResults) {
        const status = result.metrics.accuracy >= 80 ? '✅' : '⚠️';
        console.log(`${status} ${result.agentName}`);
        console.log(`   Accuracy: ${result.metrics.accuracy.toFixed(1)}% | F1: ${result.metrics.f1Score.toFixed(1)}%`);
        console.log(`   Website: ${result.sourceUrl}`);
    }

    // Category performance across all agents
    console.log(`\n📊 Performance by Category (Averaged across all agents):`);
    console.log('─'.repeat(80));

    const categories = [...new Set(testQueries.map(q => q.category))];
    for (const cat of categories) {
        const catResults = allAgentResults.flatMap(agent =>
            agent.results.filter(r => r.category === cat)
        );
        const catAccuracy = catResults.filter(r => r.isCorrect).length / catResults.length * 100;
        const avgConfidence = catResults.filter(r => r.confidence).reduce((sum, r) => sum + r.confidence, 0) / catResults.filter(r => r.confidence).length || 0;
        console.log(`   ${cat}: ${catAccuracy.toFixed(0)}% accuracy, ${avgConfidence.toFixed(1)}% avg confidence`);
    }

    // Consistency analysis
    console.log(`\n📊 System Consistency Analysis:`);
    console.log('─'.repeat(80));

    const accuracies = allAgentResults.map(r => r.metrics.accuracy);
    const minAccuracy = Math.min(...accuracies);
    const maxAccuracy = Math.max(...accuracies);
    const stdDev = Math.sqrt(
        accuracies.reduce((sum, acc) => sum + Math.pow(acc - totalAccuracy, 2), 0) / accuracies.length
    );

    console.log(`   Min Accuracy: ${minAccuracy.toFixed(1)}%`);
    console.log(`   Max Accuracy: ${maxAccuracy.toFixed(1)}%`);
    console.log(`   Standard Deviation: ${stdDev.toFixed(1)}%`);
    console.log(`   Consistency Rating: ${stdDev < 10 ? '✅ Excellent' : stdDev < 20 ? '⚠️ Good' : '❌ Needs Improvement'}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Multi-Agent Test Complete!');
    console.log('='.repeat(80));
}

runMultiAgentTest().catch(console.error);
