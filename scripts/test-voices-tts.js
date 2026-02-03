/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test TTS generation for all realistic voices
 * Verifies each voice ID works with FishAudio API
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;

if (!FISH_API_KEY) {
    console.error('❌ Missing FISH_AUDIO_API_KEY in .env.local');
    process.exit(1);
}

// Test voices (matching src/lib/fishaudio.ts)
const TEST_VOICES = [
    { id: '1b160c4cf02e4855a09efd59475b9370', name: 'Sophia - Professional', gender: 'female', style: 'professional' },
    { id: '76f7e17483084df6b0f1bcecb5fb13e9', name: 'Marcus - Confident', gender: 'male', style: 'confident' },
    { id: '34b01f00fd8f4e12a664d1e081c13312', name: 'David - Friendly', gender: 'male', style: 'friendly' },
    { id: 'ab9f86c943514589a52c00f55088e1ae', name: 'E Girl - Playful', gender: 'female', style: 'playful' },
    { id: '4a98f7c293ee44898705529cc8ccc7d6', name: 'Kawaii - Cute', gender: 'female', style: 'cute' }
];

const TEST_TEXT = "Hello! I am your AI voice assistant. This is a test of my realistic human voice. How may I help you today?";

async function testVoiceTTS(voice) {
    try {
        console.log(`\n🎤 Testing: ${voice.name} (${voice.gender})`);
        console.log(`   Voice ID: ${voice.id}`);

        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: TEST_TEXT,
                reference_id: voice.id,
                format: 'mp3',
                sample_rate: 44100  // FishAudio requires 32000 or 44100 for mp3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`   ❌ API Error: ${response.status} - ${errorText}`);
            return { success: false, voice: voice.name, error: `${response.status} ${errorText}` };
        }

        const audioBuffer = await response.arrayBuffer();
        const audioSize = audioBuffer.byteLength;

        // Save test audio file
        const outputDir = path.join(__dirname, '..', 'test-outputs');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = `${voice.name.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, Buffer.from(audioBuffer));

        console.log(`   ✅ Success: ${audioSize.toLocaleString()} bytes`);
        console.log(`   📁 Saved: ${filename}`);

        return { success: true, voice: voice.name, size: audioSize, file: filename };
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { success: false, voice: voice.name, error: error.message };
    }
}

async function runAllTests() {
    console.log('=== Voice TTS Testing ===');
    console.log(`Testing ${TEST_VOICES.length} voices with FishAudio API\n`);
    console.log(`Test phrase: "${TEST_TEXT}"\n`);
    console.log('═'.repeat(60));

    const results = [];

    for (const voice of TEST_VOICES) {
        const result = await testVoiceTTS(voice);
        results.push(result);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Results Summary:\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}/${TEST_VOICES.length}`);
    successful.forEach(r => {
        console.log(`   ✓ ${r.voice} - ${r.size.toLocaleString()} bytes - ${r.file}`);
    });

    if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}/${TEST_VOICES.length}`);
        failed.forEach(r => {
            console.log(`   ✗ ${r.voice} - ${r.error}`);
        });
    }

    console.log('\n' + '═'.repeat(60));

    if (successful.length === TEST_VOICES.length) {
        console.log('✅ ALL VOICES WORKING! Ready for production.');
        console.log('\nℹ️  Test audio files saved to: test-outputs/');
        console.log('   Listen to verify realistic human quality.');
    } else {
        console.log(`⚠️  ${failed.length} voice(s) failed. Check voice IDs and API key.`);
    }

    // Voice quality checklist
    console.log('\n📋 Manual Quality Checklist:');
    console.log('   [ ] Sophia - Sounds professional and clear (not robotic)');
    console.log('   [ ] Marcus - Sounds confident and authoritative (not robotic)');
    console.log('   [ ] David - Sounds friendly and conversational (not robotic)');
    console.log('   [ ] E Girl - Sounds playful (legacy voice)');
    console.log('   [ ] Kawaii - Sounds cute (legacy voice)');
    console.log('\n🎧 Listen to test-outputs/*.mp3 files to verify quality!');
}

runAllTests();
