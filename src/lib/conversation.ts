// Real-time Conversation Handler
// Manages voice conversations with agents

import { ConversationMessage, AgentSession } from './types';
import { getAgentById, getKnowledgeBaseByAgentId } from './db';
import { retrieveRelevantChunks, generateSimpleResponse } from './rag';
import { generateTTSAudio } from './fishaudio';
import { getAnimatedFaceData } from './simile';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationState {
    session: AgentSession;
    messages: ConversationMessage[];
    isAgentSpeaking: boolean;
    isBargingIn: boolean;
}

const activeSessions: Map<string, ConversationState> = new Map();

// Start a new conversation session
export async function startSession(agentId: string): Promise<ConversationState | null> {
    const agent = await getAgentById(agentId);
    if (!agent) return null;

    const session: AgentSession = {
        id: uuidv4(),
        agentId,
        startedAt: new Date(),
        status: 'active'
    };

    const state: ConversationState = {
        session,
        messages: [],
        isAgentSpeaking: false,
        isBargingIn: false
    };

    activeSessions.set(session.id, state);
    return state;
}

// Handle user input
export async function handleUserInput(
    sessionId: string,
    userText: string
): Promise<{
    responseText: string;
    audioUrl: string;
    videoUrl: string;
} | null> {
    const state = activeSessions.get(sessionId);
    if (!state) return null;

    const agent = await getAgentById(state.session.agentId);
    if (!agent) return null;

    // Record user message
    const userMessage: ConversationMessage = {
        id: uuidv4(),
        sessionId,
        role: 'user',
        content: userText,
        timestamp: new Date()
    };
    state.messages.push(userMessage);

    // Get knowledge base and find relevant context
    const kb = await getKnowledgeBaseByAgentId(agent.id);
    let responseText: string;

    if (kb) {
        const relevantChunks = retrieveRelevantChunks(kb, userText);
        responseText = generateSimpleResponse(userText, relevantChunks);
    } else {
        responseText = "Hello! I'm here to help. How can I assist you today?";
    }

    // Generate TTS
    state.isAgentSpeaking = true;
    const audioData = await generateTTSAudio(responseText, agent.voiceId || 'default');

    // Generate face animation state
    const faceState = getAnimatedFaceData(agent.faceId || 'default', 'speaking');

    // Record agent message
    const agentMessage: ConversationMessage = {
        id: uuidv4(),
        sessionId,
        role: 'agent',
        content: responseText,
        timestamp: new Date()
    };
    state.messages.push(agentMessage);
    state.isAgentSpeaking = false;

    return {
        responseText,
        audioUrl: audioData ? '/api/tts' : '',
        videoUrl: faceState.expression
    };
}

// Handle barge-in (user interrupts agent)
export function handleBargeIn(sessionId: string): boolean {
    const state = activeSessions.get(sessionId);
    if (!state || !state.isAgentSpeaking) return false;

    state.isBargingIn = true;
    state.isAgentSpeaking = false;
    return true;
}

// End session
export function endSession(sessionId: string): boolean {
    const state = activeSessions.get(sessionId);
    if (!state) return false;

    state.session.status = 'ended';
    activeSessions.delete(sessionId);
    return true;
}

// Get session state
export function getSessionState(sessionId: string): ConversationState | undefined {
    return activeSessions.get(sessionId);
}

// Generate greeting message
export async function generateGreeting(agentId: string): Promise<{
    text: string;
    audioUrl: string;
    videoUrl: string;
} | null> {
    const agent = await getAgentById(agentId);
    if (!agent) return null;

    const greeting = "Hi there! I'm here to help you with any questions about our services. How can I assist you today?";

    const audioData = await generateTTSAudio(greeting, agent.voiceId || 'default');
    const faceState = getAnimatedFaceData(agent.faceId || 'default', 'speaking');

    return {
        text: greeting,
        audioUrl: audioData ? '/api/tts' : '',
        videoUrl: faceState.expression
    };
}
