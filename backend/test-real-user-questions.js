/**
 * Test agents with real user questions - questions real customers would actually ask
 */

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { retrieveAnswer } = require('./lib/retrieval');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Real-world questions that actual customers would ask
const realUserQuestions = {
    'c77978d2-9761-415d-a3fc-ab957e015d18': { // OpenAI Docs
        name: 'OpenAI Docs Agent',
        questions: [
            "What API models are available?",
            "How do I get started with the API?",
            "What's the pricing?",
            "How do I authenticate?",
            "Can I use this for commercial projects?",
            "What's the rate limit?",
            "How do I handle errors?",
            "Is there a free tier?",
            "What programming languages are supported?",
            "How do I make my first API call?"
        ]
    },
    'b70fd02a-9360-45b5-9e29-5440eced2a64': { // Coffee Shop
        name: 'Coffee Shop Agent',
        questions: [
            "What time do you open?",
            "Where are you located?",
            "Do you have oat milk?",
            "Can I order online?",
            "Do you do catering?",
            "What's your most popular drink?",
            "Do you have food?",
            "Is there wifi?",
            "Do you have decaf?",
            "Can I buy gift cards?"
        ]
    },
    'af27770f-a57d-46d9-841c-aaaf5d043cff': { // Restaurant
        name: 'Restaurant Agent',
        questions: [
            "Do you take reservations?",
            "What are your hours?",
            "Do you have vegetarian options?",
            "Can I order for delivery?",
            "Do you have gluten-free menu items?",
            "Is there parking?",
            "Do you have a kids menu?",
            "Can I order ahead?",
            "Do you do catering?",
            "What's on the menu?"
        ]
    },
    '5eef743c-5ca8-4b5f-98e4-9f016fc28ef2': { // Fitness
        name: 'Fitness Agent',
        questions: [
            "How much does a membership cost?",
            "What classes do you offer?",
            "Do you have a free trial?",
            "What are your hours?",
            "Do I need to sign a contract?",
            "Can I bring a guest?",
            "Do you have personal trainers?",
            "Where are you located?",
            "What equipment do you have?",
            "Can I freeze my membership?"
        ]
    }
};

async function testAgentWithRealQuestions(agentId, agentInfo) {
    console.log('\n' + '='.repeat(80));
    console.log(`🧑 Testing ${agentInfo.name} with REAL USER QUESTIONS`);
    console.log(`   Agent ID: ${agentId}`);
    console.log('='.repeat(80));

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (let i = 0; i < agentInfo.questions.length; i++) {
        const question = agentInfo.questions[i];

        console.log(`\n${i + 1}. 💬 User asks: "${question}"`);
        console.log('-'.repeat(80));

        try {
            const result = await retrieveAnswer(agentId, question);

            // Check if answer is meaningful (not fallback)
            const isSuccess = result.success && result.confidence > 20;

            if (isSuccess) {
                successCount++;
                confidenceSum += result.confidence;
                confidenceCount++;
                console.log(`   ✅ Answered successfully`);
            } else {
                failureCount++;
                console.log(`   ❌ Failed to answer (low confidence or no result)`);
            }

            console.log(`   📊 Confidence: ${result.confidence?.toFixed(1) || 0}%`);
            console.log(`   🎯 Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);

            // Show a preview of the answer
            const answerPreview = result.answer?.substring(0, 150).replace(/\n/g, ' ');
            console.log(`   💬 Answer: ${answerPreview}...`);

            results.push({
                question,
                success: isSuccess,
                confidence: result.confidence || 0,
                similarity: result.similarity || 0,
                answer: result.answer
            });

        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            failureCount++;
            results.push({
                question,
                success: false,
                confidence: 0,
                similarity: 0,
                error: error.message
            });
        }
    }

    // Calculate metrics
    const totalQuestions = agentInfo.questions.length;
    const successRate = (successCount / totalQuestions) * 100;
    const avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;

    console.log('\n' + '─'.repeat(80));
    console.log(`📊 ${agentInfo.name} Performance Summary`);
    console.log('─'.repeat(80));
    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`✅ Successful Answers: ${successCount} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed Answers: ${failureCount}`);
    console.log(`📈 Average Confidence: ${avgConfidence.toFixed(1)}%`);

    // Show questions that failed
    if (failureCount > 0) {
        console.log(`\n⚠️  Questions that failed:`);
        results.filter(r => !r.success).forEach((r, idx) => {
            console.log(`   ${idx + 1}. "${r.question}" (confidence: ${r.confidence.toFixed(1)}%)`);
        });
    }

    return {
        agentId,
        agentName: agentInfo.name,
        totalQuestions,
        successCount,
        failureCount,
        successRate,
        avgConfidence,
        results
    };
}

async function runRealUserTest() {
    console.log('🧪 REAL USER QUESTIONS TEST\n');
    console.log('Testing agents with questions that actual customers would ask\n');

    const allResults = [];

    // Test each agent
    for (const [agentId, agentInfo] of Object.entries(realUserQuestions)) {
        const result = await testAgentWithRealQuestions(agentId, agentInfo);
        allResults.push(result);
    }

    // Overall system performance
    console.log('\n\n' + '='.repeat(80));
    console.log('🌐 OVERALL SYSTEM PERFORMANCE WITH REAL USER QUESTIONS');
    console.log('='.repeat(80));

    const totalQuestions = allResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    const totalSuccess = allResults.reduce((sum, r) => sum + r.successCount, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failureCount, 0);
    const overallSuccessRate = (totalSuccess / totalQuestions) * 100;
    const avgConfidenceAcrossAgents = allResults.reduce((sum, r) => sum + r.avgConfidence, 0) / allResults.length;

    console.log(`\n📊 Tested Agents: ${allResults.length}`);
    console.log(`📊 Total Questions Asked: ${totalQuestions}`);
    console.log(`✅ Total Successful Answers: ${totalSuccess}`);
    console.log(`❌ Total Failed Answers: ${totalFailed}`);
    console.log(`\n📈 Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`📈 Average Confidence: ${avgConfidenceAcrossAgents.toFixed(1)}%`);

    console.log(`\n🎯 Target: 70%+ success rate for real user questions`);
    if (overallSuccessRate >= 70) {
        console.log(`✅ TARGET ACHIEVED! (${overallSuccessRate.toFixed(1)}% success rate)`);
    } else {
        console.log(`⚠️  Need ${(70 - overallSuccessRate).toFixed(1)}% improvement`);
    }

    // Agent-by-agent breakdown
    console.log(`\n📊 Performance by Agent:`);
    console.log('─'.repeat(80));

    for (const result of allResults) {
        const status = result.successRate >= 70 ? '✅' : '⚠️';
        console.log(`${status} ${result.agentName}`);
        console.log(`   Success Rate: ${result.successRate.toFixed(1)}% (${result.successCount}/${result.totalQuestions} questions)`);
        console.log(`   Avg Confidence: ${result.avgConfidence.toFixed(1)}%`);
        console.log(`   Questions answered: ${result.successCount}, Failed: ${result.failureCount}`);
    }

    // Identify common failure patterns
    console.log(`\n📊 Analysis:`);
    console.log('─'.repeat(80));

    const allFailedQuestions = allResults.flatMap(r =>
        r.results.filter(q => !q.success).map(q => ({
            agent: r.agentName,
            question: q.question,
            confidence: q.confidence
        }))
    );

    if (allFailedQuestions.length > 0) {
        console.log(`\n⚠️  All failed questions (${allFailedQuestions.length} total):`);
        allFailedQuestions.forEach((fq, idx) => {
            console.log(`   ${idx + 1}. [${fq.agent}] "${fq.question}" (confidence: ${fq.confidence.toFixed(1)}%)`);
        });
    } else {
        console.log(`\n✅ No failures! All agents answered all real user questions successfully.`);
    }

    // Best and worst performing agents
    const sortedBySuccess = [...allResults].sort((a, b) => b.successRate - a.successRate);
    console.log(`\n🏆 Best Performing Agent: ${sortedBySuccess[0].agentName} (${sortedBySuccess[0].successRate.toFixed(1)}% success)`);
    console.log(`⚠️  Needs Most Improvement: ${sortedBySuccess[sortedBySuccess.length - 1].agentName} (${sortedBySuccess[sortedBySuccess.length - 1].successRate.toFixed(1)}% success)`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Real User Questions Test Complete!');
    console.log('='.repeat(80));
}

runRealUserTest().catch(console.error);
