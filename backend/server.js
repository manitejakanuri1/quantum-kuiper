/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Voice Agent WebSocket Backend Server
 *
 * Handles real-time voice conversations:
 * - Receives audio from browser
 * - Uses OpenAI Whisper for speech-to-text
 * - Uses OpenAI GPT for AI responses (with RAG context)
 * - Uses FishAudio for text-to-speech
 * - Sends audio back to browser for Simli lip-sync
 */

require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Active sessions
const sessions = new Map();

// Face ID to Voice ID mapping based on gender - ALL FishAudio voices
// Female faces (Tina, Doctor) → Custom kawaii female voice
// Male faces (Sabour, Mark) → FishAudio male voice (Adrian)
const FACE_VOICE_MAP = {
    // Female faces → Custom kawaii female voice from FishAudio
    'cace3ef7-a4c4-425d-a8cf-a5358eb0c427': '4a98f7c293ee44898705529cc8ccc7d6', // Tina → Kawaii Female
    'f0ba4efe-7946-45de-9955-c04a04c367b9': '4a98f7c293ee44898705529cc8ccc7d6', // Doctor → Kawaii Female

    // Male faces → FishAudio male voice (Adrian)
    '7e74d6e7-d559-4394-bd56-4923a3ab75ad': 'bf322df2096a46f18c579d0baa36f41d', // Sabour → Adrian (Male)
    '804c347a-26c9-4dcf-bb49-13df4bed61e8': 'bf322df2096a46f18c579d0baa36f41d', // Mark → Adrian (Male)
};

// Get voice ID based on face ID (ALWAYS use face mapping, ignore stored voiceId)
function getVoiceForFace(faceId) {
    console.log('🔍 getVoiceForFace called with faceId:', faceId);
    console.log('🔍 FACE_VOICE_MAP keys:', Object.keys(FACE_VOICE_MAP));

    // Check if we have a mapping for this face
    const mappedVoice = FACE_VOICE_MAP[faceId];
    console.log('🔍 Mapped voice for this faceId:', mappedVoice);

    if (mappedVoice) {
        console.log('✅ Using mapped voice:', mappedVoice);
        return mappedVoice;
    }

    console.log('⚠️ No mapping found, using default Kawaii Female');
    return '4a98f7c293ee44898705529cc8ccc7d6'; // Default to Kawaii Female
}

// Text-to-Speech function using FishAudio API ONLY (no OpenAI fallback)
// Generates PCM16 16kHz mono audio for Simli
async function textToSpeech(text, voiceId, faceId) {
    const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || 'd4585642eb6a45b5ac96a82ae1285cd0';

    // Get the appropriate voice based on face gender (ignores stored voiceId)
    const actualVoiceId = getVoiceForFace(faceId);

    console.log('🔊 Generating TTS for:', text.substring(0, 50) + '...');
    console.log('🎤 Face ID:', faceId);
    console.log('🎤 Voice ID (mapped):', actualVoiceId);

    if (!FISH_API_KEY) {
        console.warn('⚠️ FishAudio API key not set');
        return new Uint8Array(6000).buffer;
    }

    try {
        // Request PCM format from FishAudio at 16kHz - exact format Simli needs
        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                reference_id: actualVoiceId,
                format: 'pcm',
                sample_rate: 16000  // Exact sample rate Simli needs
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ FishAudio API error:', response.status, errorText);
            throw new Error(`FishAudio error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ FishAudio PCM received:', audioBuffer.byteLength, 'bytes');

        return audioBuffer;
    } catch (error) {
        console.error('❌ FishAudio TTS error:', error.message);
        // Return silent audio on error (no OpenAI fallback)
        return new Uint8Array(6000).buffer;
    }
}

// OpenAI TTS fallback
async function openaiTTSFallback(text, voiceId) {
    const voiceMap = {
        '8ef4a238714b45718ce04243307c57a7': 'shimmer',
        'default-female': 'nova',
        'default-male': 'onyx'
    };
    const openaiVoice = voiceMap[voiceId] || 'shimmer';

    try {
        const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: openaiVoice,
            input: text,
            response_format: 'pcm'
        });
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ OpenAI fallback TTS generated:', audioBuffer.byteLength, 'bytes');
        return audioBuffer;
    } catch (error) {
        console.error('❌ OpenAI TTS error:', error.message);
        return new Uint8Array(6000).buffer;
    }
}

// Speech to text using OpenAI Whisper
async function speechToText(audioBuffer) {
    try {
        console.log('Processing audio buffer of size:', audioBuffer.length);
        return null; // Will use transcript from client instead
    } catch (error) {
        console.error('STT error:', error);
        return null;
    }
}

// ============== SIMLI REST API INTEGRATION ==============

// Generate MP3 audio with FishAudio for Simli REST API
async function textToSpeechMP3(text, voiceId) {
    const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || 'd4585642eb6a45b5ac96a82ae1285cd0';

    console.log('🔊 Generating MP3 TTS for:', text.substring(0, 50) + '...');

    try {
        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                reference_id: voiceId || '8ef4a238714b45718ce04243307c57a7',
                format: 'mp3',
                sample_rate: 24000
            })
        });

        if (!response.ok) throw new Error('FishAudio MP3 error');

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ FishAudio MP3 received:', audioBuffer.byteLength, 'bytes');
        return audioBuffer;
    } catch (error) {
        console.error('❌ FishAudio MP3 error:', error.message);
        return null;
    }
}

// Generate avatar video using Simli REST API
async function generateSimliVideo(audioBuffer, faceId) {
    const SIMLI_API_KEY = process.env.SIMLI_API_KEY || process.env.NEXT_PUBLIC_SIMLI_API_KEY;

    if (!SIMLI_API_KEY || !audioBuffer) {
        console.error('❌ Missing Simli API key or audio');
        return null;
    }

    console.log('🎬 Generating Simli video for face:', faceId);

    try {
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        const response = await fetch('https://api.simli.ai/audioToVideoStream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                simliAPIKey: SIMLI_API_KEY,
                faceId: faceId || 'tmp9i8bbq7c',
                audioBase64: audioBase64,
                audioFormat: 'mp3',
                audioSampleRate: 24000,
                audioChannelCount: 1,
                videoStartingFrame: 0,
                disableSuperRes: false
            })
        });

        if (!response.ok) {
            console.error('❌ Simli API error:', response.status);
            return null;
        }

        const result = await response.json();
        console.log('✅ Simli video URLs:', result);
        return result; // { hls_url, mp4_url }
    } catch (error) {
        console.error('❌ Simli video error:', error.message);
        return null;
    }
}

// Combined: Generate TTS + Video
async function generateSpeechWithVideo(text, voiceId, faceId) {
    const audioBuffer = await textToSpeechMP3(text, voiceId);
    if (!audioBuffer) return { audioBuffer: null, videoUrl: null };

    const videoResult = await generateSimliVideo(audioBuffer, faceId);
    return {
        audioBuffer,
        mp4Url: videoResult?.mp4_url || null,
        hlsUrl: videoResult?.hls_url || null
    };
}

// Generate AI response using OpenAI with RAG context
async function generateResponse(userMessage, context, agentName = 'Assistant') {
    console.log('🤖 Generating AI response for:', userMessage);
    console.log('📝 Agent name:', agentName);

    try {
        const systemPrompt = `You are ${agentName}, a helpful AI voice assistant. 
Keep your responses conversational and concise (2-3 sentences max).
Use the following context to answer questions:

${context || 'No additional context available.'}

If you don't know something, say so briefly.`;

        console.log('📤 Calling OpenAI API...');
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            max_tokens: 150,
            temperature: 0.7
        });

        const aiText = response.choices[0].message.content;
        console.log('✅ OpenAI response:', aiText);
        return aiText;
    } catch (error) {
        console.error('OpenAI error:', error);
        return "I'm sorry, I'm having trouble responding right now. Please try again.";
    }
}

// REST endpoint to start conversation
app.post('/start-conversation', (req, res) => {
    const { prompt, voiceId, agentId, context, agentName, faceId } = req.body;
    const connectionId = uuidv4();

    // Default to E Girl voice if no valid voice ID provided
    const defaultVoiceId = '8ef4a238714b45718ce04243307c57a7';

    sessions.set(connectionId, {
        prompt: prompt || 'You are a helpful assistant.',
        voiceId: voiceId || defaultVoiceId,
        faceId: faceId || '', // Store face ID for voice mapping
        agentId: agentId,
        agentName: agentName || 'your assistant',
        context: context || '',
        messages: [],
        createdAt: new Date()
    });

    console.log('Session created:', connectionId, 'Voice:', voiceId || defaultVoiceId, 'Face:', faceId);

    res.json({
        success: true,
        connectionId,
        message: 'Session created. Connect via WebSocket.'
    });
});

// NEW: REST endpoint for video generation (Simli REST API approach)
app.post('/generate-video', async (req, res) => {
    const { text, voiceId, faceId, agentName } = req.body;

    console.log('🎬 Video generation request:', { text: text?.substring(0, 50), voiceId, faceId });

    try {
        // Generate AI response if no text provided
        let responseText = text;
        if (!responseText) {
            responseText = `Hello! I'm ${agentName || 'your assistant'}. How can I help you today?`;
        }

        // Generate TTS + Video using Simli REST API
        const result = await generateSpeechWithVideo(responseText, voiceId, faceId);

        if (!result.mp4Url) {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate video',
                text: responseText
            });
        }

        res.json({
            success: true,
            text: responseText,
            mp4Url: result.mp4Url,
            hlsUrl: result.hlsUrl
        });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const connectionId = url.searchParams.get('connectionId');

    if (!connectionId || !sessions.has(connectionId)) {
        ws.close(1008, 'Invalid connection ID');
        return;
    }

    const session = sessions.get(connectionId);
    console.log('WebSocket connected:', connectionId);

    // Send greeting automatically when agent starts
    setTimeout(async () => {
        try {
            console.log('🎤 Sending greeting...');
            console.log('📋 Session data - Voice:', session.voiceId, 'Face:', session.faceId);
            const greeting = `Hello! I'm ${session.agentName || 'your assistant'}. How can I help you today?`;

            // Send text first so UI shows it
            ws.send(JSON.stringify({ type: 'text', content: greeting }));
            console.log('📝 Text sent:', greeting);

            // Generate and send audio for lip-sync
            const audioBuffer = await textToSpeech(greeting, session.voiceId, session.faceId);
            if (audioBuffer && audioBuffer.byteLength > 100) {
                ws.send(audioBuffer);
                console.log('🔊 Audio sent:', audioBuffer.byteLength, 'bytes');
            } else {
                console.warn('⚠️ Audio buffer too small or empty');
            }
        } catch (err) {
            console.error('Error sending greeting:', err);
        }
    }, 2000); // Wait 2 seconds for Simli to fully connect

    // Handle incoming messages (audio chunks or text)
    ws.on('message', async (data) => {
        try {
            // Check if it's JSON (text message) or binary (audio)
            if (typeof data === 'string' || data instanceof Buffer) {
                let parsedData;
                try {
                    parsedData = JSON.parse(data.toString());
                } catch {
                    // It's binary audio data, handle accordingly
                    console.log('Received audio chunk');
                    return;
                }

                if (parsedData.type === 'text') {
                    // Direct text input
                    const userText = parsedData.content;
                    console.log('User said:', userText);

                    // Generate AI response
                    const aiResponse = await generateResponse(
                        userText,
                        session.context,
                        session.prompt
                    );
                    console.log('AI response:', aiResponse);

                    // Send text response
                    ws.send(JSON.stringify({ type: 'text', content: aiResponse }));

                    // Generate and send audio
                    const audioBuffer = await textToSpeech(aiResponse, session.voiceId);
                    if (audioBuffer) {
                        ws.send(audioBuffer);
                    }
                } else if (parsedData.type === 'interrupt') {
                    // Handle barge-in
                    ws.send(JSON.stringify({ type: 'interrupt' }));
                }
            }
        } catch (error) {
            console.error('Message handling error:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket disconnected:', connectionId);
        // Clean up session after some delay
        setTimeout(() => sessions.delete(connectionId), 60000);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', sessions: sessions.size });
});

// Start server
const PORT = process.env.BACKEND_PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Voice Agent Backend running on port ${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   REST API: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 API Keys Status:');
    console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   FishAudio: ${process.env.FISH_AUDIO_API_KEY ? '✅ Set' : '❌ Missing'}`);
});
