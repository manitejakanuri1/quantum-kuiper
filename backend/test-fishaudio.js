/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test FishAudio TTS API directly
 */
require('dotenv').config({ path: '../.env.local' });

// Use the new paid API key for testing
const FISH_API_KEY = '66fda726e1cf4be4b1d0ef9a8999b171';
const VOICE_ID = '8ef4a238714b45718ce04243307c57a7';

async function testFishAudioTTS() {
    console.log('=== FishAudio TTS Test ===');
    console.log('API Key:', FISH_API_KEY ? FISH_API_KEY.substring(0, 8) + '...' : 'MISSING');
    console.log('Voice ID:', VOICE_ID);
    console.log('');

    if (!FISH_API_KEY) {
        console.error('❌ FISH_AUDIO_API_KEY is not set in .env.local');
        return;
    }

    try {
        console.log('📤 Sending request to FishAudio...');

        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Hello! I am your AI assistant. How can I help you today?',
                reference_id: VOICE_ID,
                format: 'pcm',
                sample_rate: 16000
            })
        });

        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            return;
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Audio received:', audioBuffer.byteLength, 'bytes');

        // Save to file for testing
        const fs = require('fs');
        fs.writeFileSync('test-output.mp3', Buffer.from(audioBuffer));
        console.log('💾 Saved to test-output.mp3');
        console.log('🎧 Play this file to verify the voice!');

    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

testFishAudioTTS();
