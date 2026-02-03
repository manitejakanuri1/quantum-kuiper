/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test FishAudio TTS API with Kawaii voice
 */
require('dotenv').config({ path: '../.env.local' });

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
const KAWAII_VOICE_ID = '4a98f7c293ee44898705529cc8ccc7d6';

async function testKawaiiVoice() {
    console.log('=== FishAudio Kawaii Voice Test ===');
    console.log('Voice ID:', KAWAII_VOICE_ID);
    console.log('');

    try {
        console.log('📤 Sending request to FishAudio...');

        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Hello everyone! This is a test of the kawaii voice!',
                reference_id: KAWAII_VOICE_ID,
                format: 'pcm',
                sample_rate: 16000
            })
        });

        console.log('📥 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            return;
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Audio received:', audioBuffer.byteLength, 'bytes');
        console.log('🎉 Kawaii voice ID is VALID!');

    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

testKawaiiVoice();
