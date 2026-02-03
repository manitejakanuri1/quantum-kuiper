/**
 * Multi-Scenario RAG Testing
 * Tests the working agent (New Agent - plumbing) with diverse query types
 * to demonstrate 80%+ accuracy across different scenarios
 */

require('dotenv').config({ path: '../.env.local' });
const { retrieveAnswer } = require('./lib/retrieval');

const agentId = 'c77978d2-9761-415d-a3fc-ab957e015d18';
const agentName = 'New Agent (USA Plumbing)';

// Comprehensive test scenarios across different categories
const testScenarios = [
    // === SELF-DESCRIPTION (Critical for all agents) ===
    {
        scenario: "Self-Description #1",
        query: "Tell me about yourself",
        category: "self-description",
        shouldSucceed: true,
        minConfidence: 30
    },
    {
        scenario: "Self-Description #2",
        query: "Who are you?",
        category: "self-description",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        scenario: "Self-Description #3",
        query: "What can you help me with?",
        category: "self-description",
        shouldSucceed: true,
        minConfidence: 25
    },

    // === SERVICE QUESTIONS (Core business queries) ===
    {
        scenario: "Service Question #1",
        query: "Do you do emergency plumbing?",
        category: "services-emergency",
        shouldSucceed: true,
        minConfidence: 40
    },
    {
        scenario: "Service Question #2",
        query: "Can you fix a leaky faucet?",
        category: "services-repair",
        shouldSucceed: true,
        minConfidence: 30
    },
    {
        scenario: "Service Question #3",
        query: "Do you install water heaters?",
        category: "services-installation",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        scenario: "Service Question #4",
        query: "Can you help with drain cleaning?",
        category: "services-maintenance",
        shouldSucceed: true,
        minConfidence: 30
    },

    // === DEFINITION QUESTIONS (What is X?) ===
    {
        scenario: "Definition #1",
        query: "What is a plumbing emergency?",
        category: "definition",
        shouldSucceed: true,
        minConfidence: 35
    },
    {
        scenario: "Definition #2",
        query: "What causes pipe bursts?",
        category: "definition",
        shouldSucceed: true,
        minConfidence: 25
    },

    // === PROCEDURAL QUESTIONS (How to X?) ===
    {
        scenario: "Procedural #1",
        query: "How do I fix a leaky faucet?",
        category: "procedural",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        scenario: "Procedural #2",
        query: "How can I prevent frozen pipes?",
        category: "procedural",
        shouldSucceed: true,
        minConfidence: 20
    },

    // === FACTOID QUESTIONS (When/Where/Who) ===
    {
        scenario: "Factoid #1",
        query: "When are you available?",
        category: "factoid-time",
        shouldSucceed: true,
        minConfidence: 20
    },
    {
        scenario: "Factoid #2",
        query: "Where are you located?",
        category: "factoid-location",
        shouldSucceed: true,
        minConfidence: 20
    },

    // === BOOLEAN QUESTIONS (Yes/No) ===
    {
        scenario: "Boolean #1",
        query: "Are you available 24/7?",
        category: "boolean",
        shouldSucceed: true,
        minConfidence: 30
    },
    {
        scenario: "Boolean #2",
        query: "Do you offer free estimates?",
        category: "boolean",
        shouldSucceed: true,
        minConfidence: 20
    },

    // === LIST QUESTIONS (What services/products) ===
    {
        scenario: "List #1",
        query: "What plumbing services do you offer?",
        category: "list",
        shouldSucceed: true,
        minConfidence: 25
    },
    {
        scenario: "List #2",
        query: "What types of repairs can you do?",
        category: "list",
        shouldSucceed: true,
        minConfidence: 20
    },

    // === PRICING QUESTIONS ===
    {
        scenario: "Pricing #1",
        query: "How much do you charge?",
        category: "pricing",
        shouldSucceed: true,
        minConfidence: 15
    },
    {
        scenario: "Pricing #2",
        query: "What are your rates?",
        category: "pricing",
        shouldSucceed: true,
        minConfidence: 15
    },

    // === OUT-OF-SCOPE (Should reject) ===
    {
        scenario: "Out-of-Scope #1",
        query: "What is quantum physics?",
        category: "out-of-scope",
        shouldSucceed: false,
        minConfidence: 0
    },
    {
        scenario: "Out-of-Scope #2",
        query: "How do I bake a cake?",
        category: "out-of-scope",
        shouldSucceed: false,
        minConfidence: 0
    },
    {
        scenario: "Out-of-Scope #3",
        query: "What's the weather today?",
        category: "out-of-scope",
        shouldSucceed: false,
        minConfidence: 0
    }
];

async function runMultiScenarioTest() {
    console.log('🧪 Multi-Scenario RAG System Test\n');
    console.log('Testing RAG system across 22 diverse scenarios to validate 80%+ accuracy\n');
    console.log('='.repeat(80));
    console.log(`🤖 Agent: ${agentName}`);
    console.log(`📋 Total Scenarios: ${testScenarios.length}`);
    console.log('='.repeat(80));

    let correctAnswers = 0;
    let correctRejections = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let lowConfidenceWarnings = 0;

    const results = [];
    const categoryStats = {};

    for (const test of testScenarios) {
        console.log(`\n📝 ${test.scenario}: "${test.query}"`);
        console.log(`   Category: ${test.category} | Should succeed: ${test.shouldSucceed}`);
        console.log('-'.repeat(80));

        try {
            const result = await retrieveAnswer(agentId, test.query);

            console.log(`   Result: ${result.success ? '✅ Answered' : '❌ No answer'}`);
            console.log(`   Confidence: ${result.confidence?.toFixed(1) || 0}%`);
            if (result.similarity) {
                console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
            }

            // Track category stats
            if (!categoryStats[test.category]) {
                categoryStats[test.category] = { total: 0, correct: 0, avgConfidence: 0 };
            }
            categoryStats[test.category].total++;

            // Evaluate correctness
            let isCorrect = false;
            if (test.shouldSucceed) {
                if (result.success && result.confidence >= test.minConfidence) {
                    correctAnswers++;
                    isCorrect = true;
                    categoryStats[test.category].correct++;
                    categoryStats[test.category].avgConfidence += result.confidence;
                    console.log(`   ✅ CORRECT: Answered with confidence ≥ ${test.minConfidence}%`);
                } else if (result.success && result.confidence < test.minConfidence) {
                    lowConfidenceWarnings++;
                    isCorrect = false;
                    console.log(`   ⚠️  LOW CONFIDENCE: ${result.confidence.toFixed(1)}% < ${test.minConfidence}% threshold`);
                } else {
                    falseNegatives++;
                    console.log(`   ❌ FALSE NEGATIVE: Should have answered`);
                }
            } else {
                if (!result.success) {
                    correctRejections++;
                    isCorrect = true;
                    categoryStats[test.category].correct++;
                    console.log(`   ✅ CORRECT: Properly rejected out-of-scope`);
                } else {
                    falsePositives++;
                    console.log(`   ❌ FALSE POSITIVE: Answered out-of-scope query`);
                }
            }

            console.log(`   Answer: ${result.answer?.substring(0, 100)}...`);

            results.push({
                scenario: test.scenario,
                query: test.query,
                category: test.category,
                success: result.success,
                confidence: result.confidence || 0,
                similarity: result.similarity || 0,
                isCorrect,
                shouldSucceed: test.shouldSucceed
            });

        } catch (error) {
            console.error(`   ❌ Error:`, error.message);
            falseNegatives++;
            results.push({
                scenario: test.scenario,
                query: test.query,
                category: test.category,
                success: false,
                confidence: 0,
                isCorrect: false,
                error: error.message
            });
        }
    }

    // Calculate final metrics
    const totalTests = testScenarios.length;
    const accuracy = ((correctAnswers + correctRejections) / totalTests) * 100;
    const expectedSuccesses = testScenarios.filter(t => t.shouldSucceed).length;
    const precision = correctAnswers / (correctAnswers + falsePositives) * 100 || 0;
    const recall = correctAnswers / expectedSuccesses * 100 || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    console.log('\n\n');
    console.log('='.repeat(80));
    console.log('📊 FINAL MULTI-SCENARIO TEST RESULTS');
    console.log('='.repeat(80));

    console.log(`\n✅ Correct Answers: ${correctAnswers}/${expectedSuccesses}`);
    console.log(`✅ Correct Rejections: ${correctRejections}/${testScenarios.filter(t => !t.shouldSucceed).length}`);
    console.log(`❌ False Positives: ${falsePositives}`);
    console.log(`❌ False Negatives: ${falseNegatives}`);
    console.log(`⚠️  Low Confidence Warnings: ${lowConfidenceWarnings}`);

    console.log(`\n📈 Overall Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`📈 Precision: ${precision.toFixed(1)}%`);
    console.log(`📈 Recall: ${recall.toFixed(1)}%`);
    console.log(`📈 F1 Score: ${f1Score.toFixed(1)}%`);

    console.log(`\n🎯 Target: 80%+ accuracy`);
    if (accuracy >= 80) {
        console.log(`✅ TARGET ACHIEVED! (${accuracy.toFixed(1)}%)`);
    } else {
        console.log(`⚠️  Need ${(80 - accuracy).toFixed(1)}% improvement to reach 80%`);
    }

    // Category breakdown
    console.log(`\n📊 Performance by Category:`);
    console.log('-'.repeat(80));

    const categoryNames = Object.keys(categoryStats).sort();
    for (const cat of categoryNames) {
        const stats = categoryStats[cat];
        const catAccuracy = (stats.correct / stats.total * 100).toFixed(0);
        const avgConf = stats.correct > 0 ? (stats.avgConfidence / stats.correct).toFixed(1) : '0.0';
        const status = catAccuracy >= 80 ? '✅' : catAccuracy >= 60 ? '⚠️' : '❌';
        console.log(`${status} ${cat}: ${catAccuracy}% accuracy (${stats.correct}/${stats.total}) | Avg confidence: ${avgConf}%`);
    }

    // Top performers
    console.log(`\n🏆 Top 5 Performing Queries:`);
    console.log('-'.repeat(80));
    const topPerformers = results
        .filter(r => r.isCorrect && r.shouldSucceed)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    topPerformers.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.scenario} (${r.confidence.toFixed(1)}% confidence)`);
        console.log(`   "${r.query}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Multi-Scenario Test Complete!');
    console.log('='.repeat(80));
}

runMultiScenarioTest().catch(console.error);
