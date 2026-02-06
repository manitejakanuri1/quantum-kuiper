// RAG (Retrieval-Augmented Generation) Pipeline
// Processes scraped content and enables knowledge-based responses

import { DocumentChunk, KnowledgeBase } from './types';
import { v4 as uuidv4 } from 'uuid';

// Chunk text into smaller pieces for better retrieval
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    let currentChunk = '';

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            // Keep overlap from previous chunk
            const words = currentChunk.split(' ');
            currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ';
        }
        currentChunk += sentence + ' ';
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// Create document chunks from raw content
export function createDocumentChunks(content: string): DocumentChunk[] {
    const textChunks = chunkText(content);

    return textChunks.map(text => ({
        id: uuidv4(),
        content: text,
        // Embeddings are generated in backend using HuggingFace transformers
        embedding: undefined
    }));
}

// Create a knowledge base from scraped content
export function createKnowledgeBaseFromContent(agentId: string, content: string, sourceUrl?: string): KnowledgeBase {
    const chunks = createDocumentChunks(content);

    return {
        id: uuidv4(),
        agentId,
        sourceUrl,
        status: 'ready',
        chunks,
        createdAt: new Date()
    };
}

// Simple keyword-based retrieval (would use vector similarity in production)
export function retrieveRelevantChunks(
    knowledgeBase: KnowledgeBase,
    query: string,
    topK: number = 3
): DocumentChunk[] {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Score each chunk based on keyword matches
    const scoredChunks = knowledgeBase.chunks.map(chunk => {
        const chunkLower = chunk.content.toLowerCase();
        let score = 0;

        for (const word of queryWords) {
            if (chunkLower.includes(word)) {
                score += 1;
                // Bonus for exact phrase matches
                if (chunkLower.includes(query.toLowerCase())) {
                    score += 2;
                }
            }
        }

        return { chunk, score };
    });

    // Sort by score and return top K
    return scoredChunks
        .sort((a, b) => b.score - a.score)
        .filter(sc => sc.score > 0)
        .slice(0, topK)
        .map(sc => sc.chunk);
}

// Generate a response based on retrieved context
export function generateContextualPrompt(
    query: string,
    relevantChunks: DocumentChunk[],
    businessName?: string
): string {
    const context = relevantChunks.map(c => c.content).join('\n\n');

    return `You are a helpful voice assistant for ${businessName || 'this business'}. 
Answer the customer's question based ONLY on the following information from the website:

---
${context}
---

Customer's question: ${query}

Instructions:
- Answer naturally and conversationally, as if speaking on the phone
- Be concise but helpful (keep responses under 3 sentences when possible)
- If the information isn't in the context, politely say you don't have that specific information
- Always be professional and friendly
- Mention specific services, prices, or contact info if relevant and available

Your response:`;
}

// Simple response generation (would use LLM in production)
export function generateSimpleResponse(
    query: string,
    relevantChunks: DocumentChunk[]
): string {
    if (relevantChunks.length === 0) {
        return "I don't have specific information about that. Would you like me to connect you with our team directly?";
    }

    // For prototype, return the most relevant chunk as context
    const topChunk = relevantChunks[0];

    // Extract a sentence that seems most relevant
    const sentences = topChunk.content.split(/(?<=[.!?])\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);

    const relevantSentence = sentences.find(s =>
        queryWords.some(w => s.toLowerCase().includes(w))
    ) || sentences[0];

    return relevantSentence || "Let me help you with that. Can you tell me more about what you need?";
}
