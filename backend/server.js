/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Voice Agent WebSocket Backend Server
 *
 * Handles real-time voice conversations:
 * - Receives audio from browser
 * - Uses Deepgram for speech-to-text (client-side)
 * - Uses RAG retrieval for AI responses (NO LLM - retrieval only)
 * - Uses FishAudio for text-to-speech
 * - Sends audio back to browser for Simli lip-sync
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Debug: Check environment loading
console.log('🔍 Environment Check:');
console.log('   Working Dir:', process.cwd());
console.log('   __dirname:', __dirname);
console.log('   FISH_AUDIO_API_KEY:', process.env.FISH_AUDIO_API_KEY ? 'LOADED ✅' : 'NOT SET ❌');

const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { retrieveAnswer } = require('./lib/retrieval');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ============== RETRY UTILITY ==============

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} config - Retry configuration
 * @returns {Promise} Result of the function
 */
async function withRetry(fn, config = {}) {
    const maxRetries = config.maxRetries || 3;
    const baseDelay = config.baseDelay || 1000;
    const maxDelay = config.maxDelay || 10000;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) {
                throw lastError;
            }

            // Exponential backoff: 1s, 2s, 4s...
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt),
                maxDelay
            );

            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Execute a function with timeout
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message for timeout
 * @returns {Promise} Result of the function
 */
async function withTimeout(fn, timeoutMs, errorMessage = 'Operation timed out') {
    return Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

// Active sessions with connection limits
const sessions = new Map();
const MAX_SESSIONS = 100; // Limit concurrent sessions to prevent memory issues

// Face ID to Voice ID mapping based on gender - ALL FishAudio voices
// Female faces (Tina, Doctor) → Custom kawaii female voice
// Male faces (Sabour, Mark) → FishAudio male voice (Adrian)
const FACE_VOICE_MAP = {
    // Female faces → Realistic female voices
    'cace3ef7-a4c4-425d-a8cf-a5358eb0c427': '1b160c4cf02e4855a09efd59475b9370', // Tina → Sophia (Professional)
    'f0ba4efe-7946-45de-9955-c04a04c367b9': 'ab9f86c943514589a52c00f55088e1ae', // Doctor → E Girl (Playful)

    // Male faces → Realistic male voices
    '7e74d6e7-d559-4394-bd56-4923a3ab75ad': '76f7e17483084df6b0f1bcecb5fb13e9', // Sabour → Marcus (Confident)
    '804c347a-26c9-4dcf-bb49-13df4bed61e8': '34b01f00fd8f4e12a664d1e081c13312', // Mark → David (Friendly)
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

    console.log('⚠️ No mapping found, using default Sophia Professional');
    return '1b160c4cf02e4855a09efd59475b9370'; // Default to Sophia (Professional Female)
}

// Text-to-Speech function using FishAudio API
// Generates PCM16 16kHz mono audio for Simli
async function textToSpeech(text, voiceId, faceId) {
    const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;

    if (!FISH_API_KEY) {
        console.error('❌ FISH_AUDIO_API_KEY environment variable not set!');
        console.warn('⚠️ Returning silent audio as fallback');
        // Return silent audio instead of throwing to prevent server crash
        return new Uint8Array(6000).buffer;
    }

    // Get the appropriate voice based on face gender (ignores stored voiceId)
    const actualVoiceId = getVoiceForFace(faceId);

    console.log('🔊 Generating TTS for:', text.substring(0, 50) + '...');
    console.log('🎤 Face ID:', faceId);
    console.log('🎤 Voice ID (mapped):', actualVoiceId);

    try {
        // Wrap fetch with retry and timeout
        const response = await withRetry(
            () => withTimeout(
                () => fetch('https://api.fish.audio/v1/tts', {
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
                }),
                30000, // 30 second timeout
                'FishAudio TTS request timed out'
            ),
            { maxRetries: 3, baseDelay: 1000 }
        );

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
        // Return silent audio on error
        return new Uint8Array(6000).buffer;
    }
}

// Speech to text using Deepgram (client-side)
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
    const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;

    if (!FISH_API_KEY) {
        console.error('❌ FISH_AUDIO_API_KEY environment variable not set!');
        console.warn('⚠️ Returning silent audio as fallback');
        // Return silent audio instead of throwing to prevent server crash
        return new Uint8Array(6000).buffer;
    }

    console.log('🔊 Generating MP3 TTS for:', text.substring(0, 50) + '...');

    try {
        // Wrap fetch with retry and timeout
        const response = await withRetry(
            () => withTimeout(
                () => fetch('https://api.fish.audio/v1/tts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${FISH_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        reference_id: voiceId || '8ef4a238714b45718ce04243307c57a7',
                        format: 'mp3',
                        sample_rate: 44100  // FishAudio requires 32000 or 44100 for mp3
                    })
                }),
                30000, // 30 second timeout
                'FishAudio MP3 request timed out'
            ),
            { maxRetries: 3, baseDelay: 1000 }
        );

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

// Generate response using RAG retrieval (NO LLM!)
async function generateResponse(userMessage, context, agentName = 'Assistant', agentId = null) {
    console.log('🔍 Retrieving answer for:', userMessage);
    console.log('📝 Agent name:', agentName);
    console.log('🆔 Agent ID:', agentId);

    try {
        if (!agentId) {
            console.log('⚠️ No agentId provided, returning fallback');
            return "I don't have that information.";
        }

        // Retrieve answer from knowledge base (NO LLM!)
        const result = await retrieveAnswer(agentId, userMessage);

        if (result.success) {
            console.log(`✅ Retrieved answer (${Math.round(result.similarity * 100)}% match)`);
            console.log(`   Source: ${result.sourceUrl}`);
            return result.answer;  // Return verbatim passage!
        } else {
            console.log('⚠️ No matching content found in knowledge base');
            return result.answer;  // "I don't have that information."
        }
    } catch (error) {
        console.error('❌ Retrieval error:', error);
        return "I don't have that information.";
    }
}

// REST endpoint to start conversation
app.post('/start-conversation', (req, res) => {
    const { prompt, voiceId, agentId, context, agentName, faceId } = req.body;
    console.log('📝 Session creation request:', { agentId, voiceId, faceId, agentName });
    const connectionId = uuidv4();

    // Check session limit
    if (sessions.size >= MAX_SESSIONS) {
        return res.status(503).json({
            success: false,
            error: 'Server at capacity. Please try again later.'
        });
    }

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

    console.log('Session created:', connectionId, 'Voice:', voiceId || defaultVoiceId, 'Face:', faceId, 'AgentID:', agentId);

    res.json({
        success: true,
        connectionId,
        message: 'Session created. Connect via WebSocket.'
    });
});

// Admin Panel API Endpoints

// GET /api/agents - List all agents
app.get('/api/agents', async (req, res) => {
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: agents, error } = await supabase
            .from('agents')
            .select('id, name, website_url, status')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            agents: agents || []
        });
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/qa/:agentId - Get Q&A pairs for an agent
app.get('/api/qa/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: qaPairs, error } = await supabase
            .from('qa_pairs')
            .select('*')
            .eq('agent_id', agentId)
            .order('priority', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            qa_pairs: qaPairs || []
        });
    } catch (error) {
        console.error('Error fetching Q&A pairs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/qa/save - Save Q&A pairs (with embeddings at write-time)
app.post('/api/qa/save', async (req, res) => {
    try {
        const { agent_id, qa_pairs } = req.body;

        if (!agent_id || !qa_pairs || qa_pairs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'agent_id and qa_pairs are required'
            });
        }

        const { createClient } = require('@supabase/supabase-js');
        const { generateEmbedding } = require('./lib/retrieval');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Generate embeddings for each Q&A pair at WRITE-TIME (scale-safe)
        const pairsToInsert = await Promise.all(qa_pairs.map(async (qa) => {
            const questionEmbedding = await generateEmbedding(qa.question);
            return {
                agent_id,
                question: qa.question,
                spoken_response: qa.spoken_response,
                keywords: qa.keywords,
                priority: qa.priority || 5,
                question_embedding: questionEmbedding  // ✨ Precomputed embedding
            };
        }));

        const { data, error } = await supabase
            .from('qa_pairs')
            .insert(pairsToInsert)
            .select();

        if (error) throw error;

        console.log(`✅ Saved ${data.length} Q&A pairs with precomputed embeddings`);

        res.json({
            success: true,
            saved_count: data.length
        });
    } catch (error) {
        console.error('Error saving Q&A pairs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/qa/:agentId/:qaId - Delete a Q&A pair
app.delete('/api/qa/:agentId/:qaId', async (req, res) => {
    try {
        const { agentId, qaId } = req.params;
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase
            .from('qa_pairs')
            .delete()
            .eq('id', qaId)
            .eq('agent_id', agentId);

        if (error) throw error;

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Error deleting Q&A pair:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PUT /api/qa/:agentId/:qaId - Update a Q&A pair (with embedding regeneration)
app.put('/api/qa/:agentId/:qaId', async (req, res) => {
    try {
        const { agentId, qaId } = req.params;
        const { question, spoken_response, keywords, priority } = req.body;

        const { createClient } = require('@supabase/supabase-js');
        const { generateEmbedding } = require('./lib/retrieval');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const updateData = {};
        if (question !== undefined) {
            updateData.question = question;
            // Regenerate embedding when question changes (write-time, scale-safe)
            updateData.question_embedding = await generateEmbedding(question);
        }
        if (spoken_response !== undefined) updateData.spoken_response = spoken_response;
        if (keywords !== undefined) updateData.keywords = keywords;
        if (priority !== undefined) updateData.priority = priority;

        const { data, error } = await supabase
            .from('qa_pairs')
            .update(updateData)
            .eq('id', qaId)
            .eq('agent_id', agentId)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            qa_pair: data[0]
        });
    } catch (error) {
        console.error('Error updating Q&A pair:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// User Questions API Endpoints (for tracking unanswered questions)

// GET /api/user-questions/:agentId - Get user questions for an agent
app.get('/api/user-questions/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { unsuccessful_only } = req.query;

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        let query = supabase
            .from('user_questions')
            .select('*')
            .eq('agent_id', agentId)
            .order('asked_at', { ascending: false })
            .limit(100);

        // Filter for unsuccessful questions only if requested
        if (unsuccessful_only === 'true') {
            query = query.eq('was_successful', false);
        }

        const { data: questions, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            questions: questions || []
        });
    } catch (error) {
        console.error('Error fetching user questions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/user-questions/log - Log a user question
app.post('/api/user-questions/log', async (req, res) => {
    try {
        const { agent_id, question, answer_given, confidence, was_successful, user_session_id, answer_source } = req.body;

        if (!agent_id || !question) {
            return res.status(400).json({
                success: false,
                error: 'agent_id and question are required'
            });
        }

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase
            .from('user_questions')
            .insert({
                agent_id,
                question,
                answer_given,
                confidence,
                was_successful: was_successful !== undefined ? was_successful : false,
                user_session_id,
                answer_source: answer_source || 'vector_search'
            })
            .select();

        if (error) throw error;

        res.json({
            success: true,
            question: data[0]
        });
    } catch (error) {
        console.error('Error logging user question:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/user-questions/:questionId - Delete a user question
app.delete('/api/user-questions/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase
            .from('user_questions')
            .delete()
            .eq('id', questionId);

        if (error) throw error;

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Error deleting user question:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/user-questions/convert-to-qa - Convert user question to Q&A pair
app.post('/api/user-questions/convert-to-qa', async (req, res) => {
    try {
        const { question_id, agent_id, question, spoken_response, keywords, priority } = req.body;

        if (!agent_id || !question || !spoken_response) {
            return res.status(400).json({
                success: false,
                error: 'agent_id, question, and spoken_response are required'
            });
        }

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Create Q&A pair
        const { data: qaPair, error: qaError } = await supabase
            .from('qa_pairs')
            .insert({
                agent_id,
                question,
                spoken_response,
                keywords: keywords || [],
                priority: priority || 5
            })
            .select();

        if (qaError) throw qaError;

        // Delete the user question if question_id provided
        if (question_id) {
            await supabase
                .from('user_questions')
                .delete()
                .eq('id', question_id);
        }

        res.json({
            success: true,
            qa_pair: qaPair[0]
        });
    } catch (error) {
        console.error('Error converting question to Q&A:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/crawl - Alias for /api/crawl-website for admin panel compatibility
app.post('/api/crawl', async (req, res) => {
    const { url, agent_id, max_pages } = req.body;

    if (!url || !agent_id) {
        return res.status(400).json({
            success: false,
            error: 'url and agent_id are required'
        });
    }

    console.log(`🌐 Admin panel crawl for agent ${agent_id}: ${url}`);

    try {
        // 1. Crawl website
        const { crawlWebsite } = require('./lib/firecrawl');
        const crawlResult = await crawlWebsite(url);

        if (!crawlResult.success) {
            return res.status(500).json({
                success: false,
                error: crawlResult.error || 'Crawl failed'
            });
        }

        console.log(`✅ Crawled ${crawlResult.pages.length} pages from ${url}`);

        // 2. Fetch agent name from database
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: agent } = await supabase
            .from('agents')
            .select('name')
            .eq('id', agent_id)
            .single();

        const agentName = agent?.name || 'Voice Agent';

        // 3. Store in knowledge base
        const { storeKnowledge } = require('./lib/retrieval');
        const chunksStored = await storeKnowledge(agent_id, crawlResult.pages, agentName, url);

        console.log(`✅ Stored ${chunksStored} chunks for agent ${agent_id}`);

        // 4. Generate Q&A suggestions from content
        const contentPreview = crawlResult.pages
            .slice(0, 3)
            .map(p => p.content)
            .join('\n\n')
            .substring(0, 500);

        const qaSuggestions = [
            {
                question: "Tell me about yourself",
                source_content: `I am ${agentName}, a voice assistant for ${url}. I can help answer questions about our services, products, and more.`,
                keywords: ["about", "yourself", "who are you"]
            },
            {
                question: "What services do you offer?",
                source_content: contentPreview,
                keywords: ["services", "offer", "what do you do"]
            }
        ];

        res.json({
            success: true,
            pages_crawled: crawlResult.pages.length,
            content_preview: contentPreview,
            qa_suggestions: qaSuggestions
        });

    } catch (error) {
        console.error('❌ Admin crawl error:', error);
        res.status(500).json({
            success: false,
            error: error?.message || error?.toString() || 'Unknown error during crawl'
        });
    }
});

// NEW: REST endpoint for website crawling and knowledge base population
app.post('/api/crawl-website', async (req, res) => {
    const { agentId, websiteUrl } = req.body;

    if (!agentId || !websiteUrl) {
        return res.status(400).json({
            success: false,
            error: 'agentId and websiteUrl are required'
        });
    }

    console.log(`🌐 Starting crawl for agent ${agentId}: ${websiteUrl}`);

    try {
        // 1. Crawl website
        const { crawlWebsite } = require('./lib/firecrawl');
        const crawlResult = await crawlWebsite(websiteUrl);

        if (!crawlResult.success) {
            return res.status(500).json({
                success: false,
                error: crawlResult.error || 'Crawl failed'
            });
        }

        console.log(`✅ Crawled ${crawlResult.pages.length} pages from ${websiteUrl}`);

        // 2. Fetch agent name from database
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: agent } = await supabase
            .from('agents')
            .select('name')
            .eq('id', agentId)
            .single();

        const agentName = agent?.name || 'Voice Agent';

        // 3. Store in knowledge base with agent name and website URL
        const { storeKnowledge } = require('./lib/retrieval');
        const chunksStored = await storeKnowledge(agentId, crawlResult.pages, agentName, websiteUrl);

        console.log(`✅ Stored ${chunksStored} chunks for agent ${agentId}`);

        res.json({
            success: true,
            pagesCount: crawlResult.pages.length,
            chunksStored: chunksStored,
            message: `Successfully crawled ${crawlResult.pages.length} pages and stored ${chunksStored} chunks`
        });

    } catch (error) {
        console.error('❌ Crawl error:', error);
        res.status(500).json({
            success: false,
            error: error?.message || error?.toString() || 'Unknown error during crawl',
            details: error?.stack?.split('\n').slice(0, 3).join('\n')
        });
    }
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
    session.lastActivity = Date.now(); // Track last activity for health monitoring
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

                // ✅ Send TTS completion signal to enable hands-free mode
                ws.send(JSON.stringify({ type: 'tts_complete' }));
                console.log('✅ TTS complete signal sent (greeting)');
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

                    // Update last activity
                    session.lastActivity = Date.now();

                    // Process async to avoid blocking WebSocket
                    setImmediate(async () => {
                        try {
                            // Generate AI response using RAG
                            const aiResponse = await generateResponse(
                                userText,
                                session.context,
                                session.prompt,
                                session.agentId  // ✅ Pass agentId for RAG retrieval
                            );
                            console.log('AI response:', aiResponse);

                            // Send text response if connection still open
                            if (ws.readyState === 1) {
                                ws.send(JSON.stringify({ type: 'text', content: aiResponse }));
                            }

                            // Generate and send audio
                            const audioBuffer = await textToSpeech(aiResponse, session.voiceId, session.faceId);
                            if (audioBuffer && ws.readyState === 1) {
                                ws.send(audioBuffer);

                                // ✅ Send TTS completion signal to enable hands-free mode
                                ws.send(JSON.stringify({ type: 'tts_complete' }));
                                console.log('✅ TTS complete signal sent (response)');
                            }
                        } catch (error) {
                            console.error('Error processing message:', error);
                            if (ws.readyState === 1) {
                                ws.send(JSON.stringify({ type: 'error', content: 'Processing error' }));
                            }
                        }
                    });

                    // Send immediate acknowledgment
                    ws.send(JSON.stringify({ type: 'ack', text: userText }));
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
        // Clean up session immediately (was 60s, now 5s for better memory management)
        setTimeout(() => {
            sessions.delete(connectionId);
            console.log('Session cleaned up:', connectionId);
        }, 5000);
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
    console.log(`   FishAudio: ${process.env.FISH_AUDIO_API_KEY ? '✅ Set' : '❌ Missing'}`);
});
