/**
 * Comprehensive RAG Testing with Accuracy Metrics
 */

require('dotenv').config({ path: '../.env.local' });
const { retrieveAnswer } = require('./lib/retrieval');

const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';

// Test cases with expected answer indicators
const testCases = [
    {
        query: "Tell me about yourself",
        expectedKeywords: ['agent', 'assistant', 'help', 'website'],
        category: 'self-description',
        shouldSucceed: true
    },
    {
        query: "Do you do emergency plumbing?",
        expectedKeywords: ['emergency', '24/7', 'available', 'service'],
        category: 'services',
        shouldSucceed: true
    },
    {
        query: "What is a plumbing emergency?",
        expectedKeywords: ['emergency', 'plumbing', 'water', 'damage'],
        category: 'definition',
        shouldSucceed: true
    },
    {
        query: "How do I fix a leaky faucet?",
        expectedKeywords: ['faucet', 'leak', 'repair', 'fix'],
        category: 'procedural',
        shouldSucceed: true
    },
    {
        query: "What plumbing services are available?",
        expectedKeywords: ['service', 'plumbing', 'repair', 'install'],
        category: 'list',
        shouldSucceed: true
    },
    {
        query: "Can you help with drain cleaning?",
        expectedKeywords: ['drain', 'clean', 'clog', 'service'],
        category: 'boolean',
        shouldSucceed: true
    },
    {
        query: "Do you repair water heaters?",
        expectedKeywords: ['water heater', 'repair', 'service', 'fix'],
        category: 'boolean',
        shouldSucceed: true
    },
    {
        query: "What causes pipe bursts?",
        expectedKeywords: ['pipe', 'burst', 'freeze', 'pressure', 'damage'],
        category: 'factoid',
        shouldSucceed: true
    },
    {
        query: "Tell me about your company",
        expectedKeywords: ['company', 'plumbing', 'service', 'business'],
        category: 'definition',
        shouldSucceed: true
    },
    {
        query: "What is quantum physics?",
        expectedKeywords: [], // Should fail - not in KB
        category: 'out-of-scope',
        shouldSucceed: false
    }
];

async function runComprehensiveTest() {
    console.log('🧪 Comprehensive RAG Accuracy Test\n');
    console.log('=' .repeat(80));

    let totalTests = 0;
    let correctAnswers = 0;
    let correctRejections = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    const results = [];

    for (const testCase of testCases) {
        totalTests++;
        console.log(`\n📝 Query: "${testCase.query}"`);
        console.log(`   Category: ${testCase.category}`);
        console.log(`   Should succeed: ${testCase.shouldSucceed}`);
        console.log('-'.repeat(80));

        const result = await retrieveAnswer(agentId, testCase.query);

        console.log(`   ✅ Success: ${result.success}`);
        console.log(`   📊 Confidence: ${result.confidence?.toFixed(1)}%`);
        console.log(`   🎯 Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);

        // Check if answer contains expected keywords
        let keywordMatch = false;
        if (result.success && result.answer && testCase.expectedKeywords.length > 0) {
            const answerLower = result.answer.toLowerCase();
            const matchedKeywords = testCase.expectedKeywords.filter(kw =>
                answerLower.includes(kw.toLowerCase())
            );
            keywordMatch = matchedKeywords.length > 0;
            console.log(`   🔑 Keywords matched: ${matchedKeywords.length}/${testCase.expectedKeywords.length}`);
        }

        // Evaluate accuracy
        let isCorrect = false;
        if (testCase.shouldSucceed) {
            if (result.success && (keywordMatch || testCase.expectedKeywords.length === 0)) {
                correctAnswers++;
                isCorrect = true;
                console.log(`   ✅ CORRECT: Answered correctly`);
            } else if (result.success && !keywordMatch) {
                falsePositives++;
                console.log(`   ❌ FALSE POSITIVE: Answered but missing key info`);
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

        console.log(`   📖 Answer: ${result.answer?.substring(0, 150)}...`);

        results.push({
            query: testCase.query,
            category: testCase.category,
            success: result.success,
            confidence: result.confidence,
            similarity: result.similarity,
            isCorrect,
            shouldSucceed: testCase.shouldSucceed
        });
    }

    // Calculate overall accuracy
    console.log('\n');
    console.log('=' .repeat(80));
    console.log('📊 FINAL ACCURACY METRICS');
    console.log('=' .repeat(80));

    const overallAccuracy = ((correctAnswers + correctRejections) / totalTests) * 100;
    const precision = correctAnswers / (correctAnswers + falsePositives) * 100 || 0;
    const recall = correctAnswers / (correctAnswers + falseNegatives) * 100 || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    console.log(`\n✅ Correct Answers: ${correctAnswers}/${testCases.filter(t => t.shouldSucceed).length}`);
    console.log(`✅ Correct Rejections: ${correctRejections}/${testCases.filter(t => !t.shouldSucceed).length}`);
    console.log(`❌ False Positives: ${falsePositives}`);
    console.log(`❌ False Negatives: ${falseNegatives}`);

    console.log(`\n📈 Overall Accuracy: ${overallAccuracy.toFixed(1)}%`);
    console.log(`📈 Precision: ${precision.toFixed(1)}%`);
    console.log(`📈 Recall: ${recall.toFixed(1)}%`);
    console.log(`📈 F1 Score: ${f1Score.toFixed(1)}%`);

    console.log(`\n🎯 Target: 80%+ accuracy`);
    if (overallAccuracy >= 80) {
        console.log(`✅ TARGET ACHIEVED! (${overallAccuracy.toFixed(1)}%)`);
    } else {
        console.log(`⚠️  Need ${(80 - overallAccuracy).toFixed(1)}% improvement`);
    }

    // Category breakdown
    console.log(`\n📊 Performance by Category:`);
    const categories = [...new Set(results.map(r => r.category))];
    for (const cat of categories) {
        const catResults = results.filter(r => r.category === cat);
        const catAccuracy = catResults.filter(r => r.isCorrect).length / catResults.length * 100;
        const avgConfidence = catResults.filter(r => r.confidence).reduce((sum, r) => sum + r.confidence, 0) / catResults.filter(r => r.confidence).length || 0;
        console.log(`   ${cat}: ${catAccuracy.toFixed(0)}% accuracy, ${avgConfidence.toFixed(1)}% avg confidence`);
    }

    console.log('\n' + '='.repeat(80));
}

runComprehensiveTest().catch(console.error);
