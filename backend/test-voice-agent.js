/**
 * Voice Agent Real-Person Simulation Test
 * Tests the complete flow: REST → WebSocket → TTS → Audio
 */

require('dotenv').config({ path: '../.env.local' });
const WebSocket = require('ws');

const API_URL = 'http://localhost:8080';
const AGENT_ID = '87bdf44d-6ebf-4438-80e5-49c21e4810e0';
const FACE_ID = 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427'; // Tina (female)

// Test questions a real person might ask
const TEST_QUESTIONS = [
    "What services do you offer?",
    "What are your hours?",
    "How can I contact you?"
];

let ws;
let testIndex = 0;
let testResults = [];
let receivedGreeting = false;

async function startConversation() {
    console.log('\n' + '='.repeat(60));
    console.log('🎤 VOICE AGENT REAL-PERSON TEST');
    console.log('='.repeat(60));
    console.log(`API: ${API_URL}`);
    console.log(`Agent ID: ${AGENT_ID}`);
    console.log(`Face ID: ${FACE_ID}`);
    console.log('='.repeat(60) + '\n');

    // Step 1: Create session via REST
    console.log('📤 Creating session via /start-conversation...');

    const response = await fetch(`${API_URL}/start-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentId: AGENT_ID,
            faceId: FACE_ID,
            voiceId: '4a98f7c293ee44898705529cc8ccc7d6', // Kawaii female
            agentName: 'Test Assistant',
            context: 'This is Dubai Driving Center. We offer driving lessons and license services.',
            prompt: 'You are a helpful assistant for Dubai Driving Center.'
        })
    });

    if (!response.ok) {
        console.error('❌ Failed to create session:', response.status);
        process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Session created:', data.connectionId);

    // Step 2: Connect WebSocket with connectionId
    connectWebSocket(data.connectionId);
}

function connectWebSocket(connectionId) {
    const wsUrl = `ws://localhost:8080/ws?connectionId=${connectionId}`;
    console.log('🔌 Connecting WebSocket:', wsUrl);

    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('✅ WebSocket connected\n');
        console.log('⏳ Waiting for greeting...\n');
    });

    ws.on('message', (data) => {
        try {
            // Check if it's binary audio data
            if (Buffer.isBuffer(data) && data.length > 1000) {
                console.log(`🔊 Audio received: ${data.length} bytes`);

                if (!receivedGreeting) {
                    receivedGreeting = true;
                    console.log('\n--- Starting conversation simulation ---\n');
                    setTimeout(sendNextQuestion, 1000);
                } else {
                    testResults.push({
                        question: TEST_QUESTIONS[testIndex - 1],
                        audioBytes: data.length,
                        success: true
                    });
                    setTimeout(sendNextQuestion, 2000);
                }
                return;
            }

            const message = JSON.parse(data.toString());

            if (message.type === 'text') {
                console.log(`💬 Agent: "${message.content}"`);
            }
        } catch (e) {
            if (Buffer.isBuffer(data)) {
                console.log(`📦 Binary data: ${data.length} bytes`);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
        console.log('\n🔌 WebSocket closed');
        printResults();
    });

    // Timeout if no greeting received
    setTimeout(() => {
        if (!receivedGreeting) {
            console.log('⚠️ No greeting received, sending questions anyway...');
            receivedGreeting = true;
            sendNextQuestion();
        }
    }, 10000);
}

function sendNextQuestion() {
    if (testIndex >= TEST_QUESTIONS.length) {
        console.log('\n✅ All questions sent, waiting for final responses...');
        setTimeout(() => ws.close(), 5000);
        return;
    }

    const question = TEST_QUESTIONS[testIndex];
    testIndex++;

    console.log(`\n[${testIndex}/${TEST_QUESTIONS.length}] 🗣️  User: "${question}"`);

    // Send as text message
    ws.send(JSON.stringify({
        type: 'text',
        content: question
    }));
}

function printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    testResults.forEach((result, i) => {
        if (result.success) {
            console.log(`✅ [${i + 1}] "${result.question}" → ${result.audioBytes} bytes audio`);
            passed++;
        } else {
            console.log(`❌ [${i + 1}] "${result.question}" → Error: ${result.error}`);
            failed++;
        }
    });

    console.log('='.repeat(60));
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    const passRate = testResults.length > 0 ? ((passed / testResults.length) * 100).toFixed(1) : 0;
    console.log(`Pass Rate: ${passRate}%`);

    if (parseFloat(passRate) >= 80) {
        console.log('🚀 STATUS: VOICE AGENT WORKING CORRECTLY');
    } else {
        console.log('⚠️ STATUS: NEEDS ATTENTION');
    }
    console.log('='.repeat(60));

    process.exit(failed > passed ? 1 : 0);
}

// Start the test
startConversation().catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
});
