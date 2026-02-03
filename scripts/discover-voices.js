/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * FishAudio Voice Discovery Tool
 * Helps find realistic human voice IDs for implementation
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;

if (!FISH_API_KEY) {
    console.error('❌ FISH_AUDIO_API_KEY not set in .env.local');
    process.exit(1);
}

// Test voice IDs to try (community-recommended realistic voices)
const CANDIDATE_VOICES = [
    // Known working voices from codebase
    { id: '8ef4a238714b45718ce04243307c57a7', name: 'E Girl (Current)', gender: 'female' },
    { id: '4a98f7c293ee44898705529cc8ccc7d6', name: 'Kawaii (Current)', gender: 'female' },

    // Add candidate voice IDs here after browsing fish.audio
    // Example format:
    // { id: 'abc123...', name: 'Professional Female', gender: 'female' },
];

async function testVoice(voiceId, voiceName) {
    const testText = 'Hello! I am your AI voice assistant. How can I help you today?';

    try {
        console.log(`\n🔊 Testing: ${voiceName}`);
        console.log(`   ID: ${voiceId}`);

        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: testText,
                reference_id: voiceId,
                format: 'mp3',
                sample_rate: 24000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`   ❌ Failed: ${response.status} - ${errorText}`);
            return false;
        }

        const audioBuffer = await response.arrayBuffer();
        const fileName = `test-voice-${voiceName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.mp3`;

        fs.writeFileSync(fileName, Buffer.from(audioBuffer));

        console.log(`   ✅ Success: ${audioBuffer.byteLength} bytes`);
        console.log(`   💾 Saved to: ${fileName}`);
        console.log(`   🎧 Listen to verify quality`);

        return true;

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}

async function discoverVoices() {
    console.log('=== FishAudio Voice Discovery Tool ===\n');
    console.log('Testing candidate voices...\n');

    const results = [];

    for (const voice of CANDIDATE_VOICES) {
        const success = await testVoice(voice.id, voice.name);
        results.push({ ...voice, success });

        // Wait 500ms between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n=== Discovery Results ===\n');

    const working = results.filter(v => v.success);
    const failed = results.filter(v => !v.success);

    console.log(`✅ Working voices: ${working.length}`);
    working.forEach(v => {
        console.log(`   - ${v.name} (${v.gender}): ${v.id}`);
    });

    if (failed.length > 0) {
        console.log(`\n❌ Failed voices: ${failed.length}`);
        failed.forEach(v => {
            console.log(`   - ${v.name}: ${v.id}`);
        });
    }

    console.log('\n\n=== Next Steps ===\n');
    console.log('1. Listen to the generated MP3 files to verify voice quality');
    console.log('2. Choose 4 voices (2 female, 2 male) that sound most realistic');
    console.log('3. Update CANDIDATE_VOICES array with more voice IDs to test');
    console.log('4. Run this script again to test new candidates');
    console.log('\n📖 To find more voice IDs:');
    console.log('   - Visit https://fish.audio/tts/');
    console.log('   - Browse "Most Realistic" or "Most Popular" voices');
    console.log('   - Copy voice IDs and add them to this script');
}

discoverVoices().catch(console.error);
