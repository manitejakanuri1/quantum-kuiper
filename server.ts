/**
 * Conversation Server - LLM-Free RAG System
 * 
 * Run this server separately: npx ts-node server.ts
 * 
 * This server handles:
 * - WebSocket connections for real-time audio
 * - RAG queries to Streamlit backend (NO LLM - verbatim responses)
 * - FishAudio for Text-to-Speech (TTS)
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';
import url from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// RAG API endpoint (Streamlit backend)
const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8000';

// Connection manager - includes agentId for RAG queries
const connections = new Map<string, {
    prompt: string;
    voiceId: string;
    agentId?: string;
    ws?: WebSocket;
}>();

// Query RAG system for response (NO LLM - returns stored text verbatim)
// CRITICAL: RAG API enforces similarity threshold - if below threshold, returns fallback
async function queryRAG(agentId: string, query: string): Promise<{
    text: string;
    found: boolean;
    similarity: number;
    thresholdMet: boolean;
}> {
    try {
        console.log(`[RAG] Querying: "${query}" for agent: ${agentId}`);
        const response = await fetch(`${RAG_API_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, agent_id: agentId })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`[RAG] Found: ${data.found}, Similarity: ${(data.similarity * 100).toFixed(1)}%, Threshold Met: ${data.threshold_met}`);

            if (!data.threshold_met) {
                console.log(`[RAG] ⚠️ Similarity below threshold - using fallback response`);
            }

            return {
                text: data.text,
                found: data.found,
                similarity: data.similarity || 0,
                thresholdMet: data.threshold_met || false
            };
        }
    } catch (error) {
        console.error('[RAG] Query error:', error);
    }

    return {
        text: "I don't have specific information about that. How else can I help you?",
        found: false,
        similarity: 0,
        thresholdMet: false
    };
}

// API endpoint to start conversation
app.post('/start-conversation', (req, res) => {
    const { prompt, voiceId, agentId } = req.body;

    if (!prompt || !voiceId) {
        return res.status(400).json({ error: 'Prompt and voiceId are required' });
    }

    const connectionId = Date.now().toString();
    connections.set(connectionId, { prompt, voiceId, agentId });

    console.log(`[Server] New conversation started: ${connectionId}, Agent: ${agentId || 'default'}`);
    res.json({ connectionId, message: 'Connect to WebSocket to continue.' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', connections: connections.size, ragApi: RAG_API_URL });
});

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
    if (!request.url) {
        socket.destroy();
        return;
    }

    const { pathname, query } = url.parse(request.url, true);

    if (pathname === '/ws') {
        const connectionId = query.connectionId as string;

        if (!connectionId || !connections.has(connectionId)) {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            const connection = connections.get(connectionId)!;
            console.log(`[WebSocket] Client connected: ${connectionId}`);
            setupWebSocket(ws, connection.prompt, connection.voiceId, connection.agentId, connectionId);
        });
    } else {
        socket.destroy();
    }
});

// Setup WebSocket handlers
function setupWebSocket(
    ws: WebSocket,
    initialPrompt: string,
    voiceId: string,
    agentId: string | undefined,
    connectionId: string
) {
    // Update connection with WebSocket reference
    connections.set(connectionId, {
        ...connections.get(connectionId)!,
        ws
    });

    ws.on('message', async (message: Buffer) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === 'text' && data.content) {
                console.log(`[Text] Received from ${connectionId}: ${data.content}`);

                // Query RAG system for response (NO LLM - returns verbatim stored text)
                let response: string;
                if (agentId) {
                    const ragResult = await queryRAG(agentId, data.content);
                    response = ragResult.text;
                    console.log(`[RAG] Response: "${response.substring(0, 100)}..."`);
                } else {
                    // Fallback if no agent configured
                    response = "I'm ready to help. What would you like to know?";
                }

                // Send text response
                ws.send(JSON.stringify({
                    type: 'text',
                    content: response
                }));

                // Generate TTS audio with FishAudio
                const apiKey = process.env.FISH_AUDIO_API_KEY || process.env.FISHAUDIO_API_KEY || 'd4585642eb6a45b5ac96a82ae1285cd0';
                if (apiKey) {
                    try {
                        const ttsResponse = await fetch('https://api.fish.audio/v1/tts', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                text: response,
                                reference_id: voiceId || 'ab9f86c943514589a52c00f55088e1ae',
                                format: 'pcm',
                                sample_rate: 16000
                            })
                        });

                        if (ttsResponse.ok) {
                            const audioBuffer = await ttsResponse.arrayBuffer();
                            console.log(`[TTS] Sending ${audioBuffer.byteLength} bytes to client`);
                            ws.send(Buffer.from(audioBuffer));
                        } else {
                            console.error('[TTS] FishAudio error:', await ttsResponse.text());
                        }
                    } catch (ttsError) {
                        console.error('[TTS] Error generating audio:', ttsError);
                    }
                } else {
                    console.warn('[TTS] No API key configured');
                }
            }
        } catch (e) {
            // Binary audio data from client microphone
            console.log(`[Audio] Received ${message.length} bytes from ${connectionId}`);
        }
    });

    ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${connectionId}`);
        connections.delete(connectionId);
    });

    ws.on('error', (error) => {
        console.error(`[WebSocket] Error: ${connectionId}`, error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Ready for conversation'
    }));
}

// Simple TTS endpoint using FishAudio
app.post('/api/tts', async (req, res) => {
    const { text, voiceId } = req.body;
    const apiKey = process.env.FISH_AUDIO_API_KEY || process.env.FISHAUDIO_API_KEY || 'd4585642eb6a45b5ac96a82ae1285cd0';

    console.log('[TTS] Request:', { text: text?.substring(0, 50), voiceId, hasKey: !!apiKey });

    if (!apiKey) {
        console.error('[TTS] No API key found');
        return res.status(500).json({ error: 'FishAudio API not configured' });
    }

    try {
        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                text,
                reference_id: voiceId || 'ab9f86c943514589a52c00f55088e1ae',
                format: 'mp3'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[TTS] FishAudio error:', response.status, errorText);
            throw new Error(`FishAudio API error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('[TTS] Success, sending', audioBuffer.byteLength, 'bytes');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        console.error('[TTS] Error:', error);
        res.status(500).json({ error: 'TTS generation failed' });
    }
});

// RAG Query endpoint (for direct API access)
app.post('/api/rag/query', async (req, res) => {
    const { query, agentId } = req.body;

    if (!query || !agentId) {
        return res.status(400).json({ error: 'query and agentId are required' });
    }

    const result = await queryRAG(agentId, query);
    res.json(result);
});

// Start server
const port = process.env.CONVERSATION_SERVER_PORT || 8080;
server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║      VoiceAgent Conversation Server (LLM-Free RAG)     ║
╠════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${port}              ║
║  RAG API: ${RAG_API_URL.padEnd(42)}║
║                                                        ║
║  Endpoints:                                            ║
║  • POST /start-conversation - Start new session        ║
║  • GET  /health - Server health check                  ║
║  • WS   /ws?connectionId=xxx - WebSocket connection    ║
║  • POST /api/tts - Text-to-Speech                      ║
║  • POST /api/rag/query - Query RAG directly            ║
╚════════════════════════════════════════════════════════╝
  `);
});
