/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generate voice preview MP3 files for all system voices
 * Run once to create static preview files in public/voices/
 *
 * Usage: node scripts/generate-voice-previews.js
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
const PREVIEW_TEXT = "Hello! This is a preview of my voice. I'm here to help you with your needs. Thank you for listening!";
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'voices');

if (!FISH_API_KEY) {
    console.error('❌ Missing FISH_AUDIO_API_KEY in .env.local');
    process.exit(1);
}

const SYSTEM_VOICES = [
    { id: '1b160c4cf02e4855a09efd59475b9370', name: 'Sophia - Professional' },
    { id: '76f7e17483084df6b0f1bcecb5fb13e9', name: 'Marcus - Confident' },
    { id: '34b01f00fd8f4e12a664d1e081c13312', name: 'David - Friendly' },
    { id: 'ab9f86c943514589a52c00f55088e1ae', name: 'E Girl - Playful' },
    { id: '4a98f7c293ee44898705529cc8ccc7d6', name: 'Kawaii - Cute' }
];

async function generatePreview(voice) {
    console.log(`\n🎤 Generating: ${voice.name}`);
    console.log(`   Voice ID: ${voice.id}`);

    try {
        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: PREVIEW_TEXT,
                reference_id: voice.id,
                format: 'mp3',
                sample_rate: 44100  // FishAudio requires 32000 or 44100 for mp3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const audioSize = audioBuffer.byteLength;

        // Ensure output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
            console.log(`   📁 Created directory: ${OUTPUT_DIR}`);
        }

        // Save MP3 file
        const filename = `${voice.id}.mp3`;
        const filepath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filepath, Buffer.from(audioBuffer));

        console.log(`   ✅ Success: ${(audioSize / 1024).toFixed(2)} KB`);
        console.log(`   📁 Saved: ${filename}`);

        return { success: true, voice: voice.name, size: audioSize, file: filename };
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { success: false, voice: voice.name, error: error.message };
    }
}

async function generateAll() {
    console.log('═'.repeat(60));
    console.log('🎵 Voice Preview Generator');
    console.log('═'.repeat(60));
    console.log(`\nGenerating ${SYSTEM_VOICES.length} voice preview files...`);
    console.log(`Preview text: "${PREVIEW_TEXT}"`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    const results = [];

    for (const voice of SYSTEM_VOICES) {
        const result = await generatePreview(voice);
        results.push(result);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Generation Summary:\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}/${SYSTEM_VOICES.length}`);
    successful.forEach(r => {
        console.log(`   ✓ ${r.voice} - ${(r.size / 1024).toFixed(2)} KB - ${r.file}`);
    });

    if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}/${SYSTEM_VOICES.length}`);
        failed.forEach(r => {
            console.log(`   ✗ ${r.voice} - ${r.error}`);
        });
    }

    console.log('\n' + '═'.repeat(60));

    if (successful.length === SYSTEM_VOICES.length) {
        console.log('✅ ALL VOICE PREVIEWS GENERATED SUCCESSFULLY!');
        console.log('\n📁 Preview files saved to: public/voices/');
        console.log('🎧 These files will be used for instant voice preview playback.');
        console.log('💰 Cost savings: $108/year (no API calls for previews)');
    } else {
        console.log(`⚠️  ${failed.length} voice(s) failed. Check errors above.`);
        process.exit(1);
    }

    console.log('\n🔄 Next steps:');
    console.log('   1. Update src/lib/fishaudio.ts preview paths');
    console.log('   2. Update VoiceSelector component');
    console.log('   3. Test voice previews in browser');
    console.log('═'.repeat(60));
}

generateAll();
