const { pipeline } = require('@xenova/transformers');
const { createClient } = require('@supabase/supabase-js');

let supabase = null;

/**
 * Get or create Supabase client (lazy initialization)
 */
function getSupabase() {
    if (!supabase) {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        console.log('✅ Supabase client initialized');
    }
    return supabase;
}

let embedder = null;
let reranker = null;

// Query cache for faster repeated queries
const queryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize embedding model (FREE local model)
 */
async function getEmbedder() {
    if (!embedder) {
        console.log('📦 Loading embedding model (all-MiniLM-L6-v2)...');
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ Embedding model ready');
    }
    return embedder;
}

/**
 * Initialize reranker model (FREE local cross-encoder)
 */
async function getReranker() {
    if (!reranker) {
        console.log('📦 Loading reranker model (cross-encoder)...');
        reranker = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
        console.log('✅ Reranker ready');
    }
    return reranker;
}

/**
 * Generate embedding for text (FREE - runs locally)
 */
async function generateEmbedding(text) {
    const model = await getEmbedder();
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embeddingA - First embedding vector
 * @param {Array<number>} embeddingB - Second embedding vector
 * @returns {number} - Similarity score (0-1)
 */
function cosineSimilarity(embeddingA, embeddingB) {
    if (!embeddingA || !embeddingB || embeddingA.length !== embeddingB.length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
        dotProduct += embeddingA[i] * embeddingB[i];
        magnitudeA += embeddingA[i] * embeddingA[i];
        magnitudeB += embeddingB[i] * embeddingB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Check Q&A pairs table for matching questions (TIER 1 & 2 retrieval)
 * @param {string} agentId - Agent UUID
 * @param {string} userQuestion - User's question
 * @returns {Promise<{found: boolean, answer: string|null, confidence: number, similarity: number, source?: string}>}
 */
async function checkQAPairs(agentId, userQuestion) {
    try {
        const supabase = getSupabase();

        // Step 1: Generate embedding for user question ONCE (scale-safe)
        const queryEmbedding = await generateEmbedding(userQuestion);

        // Step 2: Database-side vector search using precomputed embeddings
        // NO EMBEDDING LOOP - uses match_qa_pairs RPC with IVFFlat index
        const { data: matches, error } = await supabase.rpc('match_qa_pairs', {
            query_embedding: queryEmbedding,
            match_agent_id: agentId,
            match_threshold: 0.70,  // 70% minimum for semantic match
            match_count: 5
        });

        if (error) {
            console.error('Error in Q&A RPC search:', error);
            return { found: false, answer: null, confidence: 0, similarity: 0 };
        }

        if (!matches || matches.length === 0) {
            console.log('   No Q&A pairs found above 70% threshold');
            return { found: false, answer: null, confidence: 0, similarity: 0 };
        }

        // Get best match (already sorted by priority DESC, similarity ASC)
        const bestMatch = matches[0];
        console.log(`   Best Q&A match: ${(bestMatch.similarity * 100).toFixed(1)}% similarity (priority: ${bestMatch.priority})`);

        // Step 3: Check match quality thresholds
        if (bestMatch.similarity >= 0.90) {
            // Exact match (90%+ similarity)
            console.log(`   ✅ Q&A EXACT MATCH (${(bestMatch.similarity * 100).toFixed(1)}%)`);
            return {
                found: true,
                answer: bestMatch.spoken_response,
                confidence: 95,
                similarity: bestMatch.similarity,
                source: 'qa_exact'
            };
        } else if (bestMatch.similarity >= 0.70) {
            // Semantic match (70-90% similarity)
            console.log(`   ✅ Q&A SEMANTIC MATCH (${(bestMatch.similarity * 100).toFixed(1)}%)`);
            return {
                found: true,
                answer: bestMatch.spoken_response,
                confidence: 75,
                similarity: bestMatch.similarity,
                source: 'qa_semantic'
            };
        } else {
            // Should not reach here due to threshold, but safety check
            console.log(`   ⏩ Similarity too low, continuing to vector search`);
            return { found: false, answer: null, confidence: 0, similarity: bestMatch.similarity };
        }
    } catch (error) {
        console.error('Error in checkQAPairs:', error);
        return { found: false, answer: null, confidence: 0, similarity: 0 };
    }
}

/**
 * Classify query intent for optimal retrieval strategy
 * Returns: { type: 'factoid'|'definition'|'procedural'|'list', confidence: 0-1 }
 */
function classifyQuery(query) {
    const lowerQuery = query.toLowerCase();

    // Factoid questions (who, when, where, specific fact)
    if (/^(who|when|where|what time|which location)\b/.test(lowerQuery)) {
        return { type: 'factoid', confidence: 0.9, needsPreciseExtraction: true };
    }

    // Definition questions (what is, tell me about)
    if (/^(what is|what are|tell me about|describe|explain)\b/.test(lowerQuery)) {
        return { type: 'definition', confidence: 0.85, needsPreciseExtraction: false };
    }

    // Procedural questions (how to, steps, process)
    if (/^(how to|how do|how can|steps to|process)\b/.test(lowerQuery)) {
        return { type: 'procedural', confidence: 0.9, needsPreciseExtraction: false };
    }

    // List questions (what services, what products, list)
    if (/\b(services|products|options|list|types|kinds)\b/.test(lowerQuery)) {
        return { type: 'list', confidence: 0.8, needsPreciseExtraction: false };
    }

    // Yes/No questions
    if (/^(do you|can you|is|are|does)\b/.test(lowerQuery)) {
        return { type: 'boolean', confidence: 0.85, needsPreciseExtraction: true };
    }

    // Default: general question
    return { type: 'general', confidence: 0.5, needsPreciseExtraction: false };
}

/**
 * Expand query with synonyms and variants (handles voice transcription errors)
 */
function expandQuery(query) {
    const expansions = [];
    const lowerQuery = query.toLowerCase();

    // Common voice transcription error corrections
    const corrections = {
        'plumming': 'plumbing',
        'plumer': 'plumber',
        'repare': 'repair',
        'emergancy': 'emergency',
        'watter': 'water',
        'heater': 'water heater',
        'leak': 'leaking pipe',
        'clog': 'clogged drain',
        'drain': 'drain cleaning'
    };

    let correctedQuery = lowerQuery;
    for (const [wrong, right] of Object.entries(corrections)) {
        if (correctedQuery.includes(wrong)) {
            correctedQuery = correctedQuery.replace(wrong, right);
        }
    }

    expansions.push(correctedQuery);

    // Add variations for common questions
    if (lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('charge')) {
        expansions.push('pricing rates fees cost');
    }
    if (lowerQuery.includes('hour') || lowerQuery.includes('time') || lowerQuery.includes('open')) {
        expansions.push('hours operation schedule availability');
    }
    if (lowerQuery.includes('emergency') || lowerQuery.includes('urgent')) {
        expansions.push('emergency 24/7 urgent immediate');
    }
    if (lowerQuery.includes('service') || lowerQuery.includes('offer') || lowerQuery.includes('do')) {
        expansions.push('services offered provide available');
    }

    return [...new Set([query, ...expansions])]; // Remove duplicates
}

/**
 * Extract keywords for BM25-style keyword matching
 */
function extractKeywords(text) {
    const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'what', 'when', 'where', 'how', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'you', 'your', 'my', 'i', 'me']);

    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopwords.has(word));
}

/**
 * Calculate keyword match score (BM25-inspired)
 */
function calculateKeywordScore(queryKeywords, chunkText) {
    const chunkLower = chunkText.toLowerCase();
    let score = 0;

    for (const keyword of queryKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = (chunkLower.match(regex) || []).length;

        if (matches > 0) {
            // TF-IDF inspired: more weight for rare words, diminishing returns for frequency
            score += Math.log(1 + matches) * 2;
        }
    }

    return score;
}

/**
 * Re-rank results using cross-encoder
 */
async function rerankResults(query, results) {
    if (results.length === 0) return results;

    try {
        const model = await getReranker();
        const rerankedResults = [];

        for (const result of results) {
            // Cross-encoder score
            const input = `Query: ${query} Document: ${result.chunk_text.substring(0, 512)}`;
            const output = await model(input);
            const relevanceScore = output[0]?.score || 0;

            rerankedResults.push({
                ...result,
                rerank_score: relevanceScore
            });
        }

        // Sort by rerank score
        rerankedResults.sort((a, b) => b.rerank_score - a.rerank_score);

        console.log(`🔄 Re-ranked ${results.length} results`);
        return rerankedResults;

    } catch (error) {
        console.warn('⚠️ Re-ranking failed, using original order:', error.message);
        return results;
    }
}

/**
 * Hybrid search: Combine semantic + keyword matching
 */
async function hybridSearch(agentId, query, options = {}) {
    const {
        semanticWeight = 0.7,
        keywordWeight = 0.3,
        matchThreshold = 0.20, // Optimized at 20% for better recall with precision filtering
        matchCount = 8 // Retrieve more candidates for better re-ranking
    } = options;

    // 1. Semantic search
    const queryEmbedding = await generateEmbedding(query);
    console.log(`🔍 Calling RPC with threshold ${matchThreshold}, count ${matchCount}`);
    const { data: semanticResults, error } = await getSupabase().rpc('match_agent_knowledge', {
        query_embedding: queryEmbedding,
        match_agent_id: agentId,
        match_threshold: matchThreshold,
        match_count: matchCount
    });

    if (error) {
        console.error('❌ RPC Error:', error.message);
        return [];
    }

    console.log(`📊 RPC returned ${semanticResults?.length || 0} results`);

    if (!semanticResults || semanticResults.length === 0) {
        console.log('⚠️ No semantic results returned from RPC');
        return [];
    }

    console.log(`✅ Top result similarity: ${(semanticResults[0].similarity * 100).toFixed(1)}%`);
    if (semanticResults[0].priority) {
        console.log(`   Priority: ${semanticResults[0].priority}`);
    }

    // 2. Keyword matching
    const queryKeywords = extractKeywords(query);

    // 3. Combine scores
    const hybridResults = semanticResults.map(result => {
        const semanticScore = result.similarity;
        const keywordScore = calculateKeywordScore(queryKeywords, result.chunk_text);

        // Normalize keyword score to 0-1 range (assuming max ~20)
        const normalizedKeywordScore = Math.min(keywordScore / 20, 1);

        const hybridScore = (semanticScore * semanticWeight) + (normalizedKeywordScore * keywordWeight);

        return {
            ...result,
            semantic_score: semanticScore,
            keyword_score: normalizedKeywordScore,
            hybrid_score: hybridScore
        };
    });

    // Sort by hybrid score
    hybridResults.sort((a, b) => b.hybrid_score - a.hybrid_score);

    return hybridResults;
}

/**
 * Multi-query retrieval: Generate variations and merge results
 */
async function multiQueryRetrieval(agentId, query) {
    const queries = expandQuery(query);
    console.log(`🔍 Multi-query retrieval with ${queries.length} variations`);

    const allResults = [];
    const seenChunks = new Set();

    for (const q of queries) {
        const results = await hybridSearch(agentId, q, {
            matchCount: 5,
            matchThreshold: 0.20  // Optimized at 20% for better recall
        });

        // Add unique results
        for (const result of results) {
            if (!seenChunks.has(result.id)) {
                seenChunks.add(result.id);
                allResults.push(result);
            }
        }
    }

    // Sort by hybrid score
    allResults.sort((a, b) => b.hybrid_score - a.hybrid_score);

    return allResults.slice(0, 5); // Top 5 unique results
}

/**
 * Extract precise answer from chunk using sentence-level analysis
 * Implements sentence window retrieval for better precision
 */
async function extractAnswer(question, chunkText, similarity) {
    try {
        // Classify query to determine extraction strategy
        const queryIntent = classifyQuery(question);

        // For high similarity (>60%) or non-factoid queries, return full chunk
        if (similarity > 0.6 || !queryIntent.needsPreciseExtraction) {
            return chunkText.trim();
        }

        // Split into sentences
        const sentences = chunkText
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 20);

        if (sentences.length === 0) {
            return chunkText.trim();
        }

        // Calculate sentence relevance scores
        const questionLower = question.toLowerCase();
        const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);

        const scoredSentences = sentences.map((sentence, idx) => {
            const sentenceLower = sentence.toLowerCase();
            let score = 0;

            // Keyword overlap scoring
            const matchedWords = questionWords.filter(w => sentenceLower.includes(w));
            score += (matchedWords.length / questionWords.length) * 50;

            // Position bonus (earlier sentences often have key info)
            score += (1 - idx / sentences.length) * 10;

            // Length bonus (not too short, not too long)
            const wordCount = sentence.split(/\s+/).length;
            if (wordCount >= 10 && wordCount <= 50) score += 15;

            // Answer pattern detection
            if (/(?:yes|no|provides|offers|includes|we|our|located|open|available|hours)/i.test(sentence)) {
                score += 20;
            }

            return { sentence, score, idx };
        });

        // Sort by score
        scoredSentences.sort((a, b) => b.score - a.score);

        // Extract top 1-3 sentences with context window
        const topSentence = scoredSentences[0];
        const windowSize = 1; // sentences before/after

        const startIdx = Math.max(0, topSentence.idx - windowSize);
        const endIdx = Math.min(sentences.length, topSentence.idx + windowSize + 1);

        const extractedSentences = sentences.slice(startIdx, endIdx);
        const answer = extractedSentences.join(' ').trim();

        // If extracted is too short, return full chunk
        if (answer.length < 100) {
            return chunkText.trim();
        }

        console.log(`📝 Extracted ${extractedSentences.length} sentences from ${sentences.length} total`);
        return answer;

    } catch (error) {
        console.error('❌ Answer extraction error:', error);
        return chunkText.trim();
    }
}

/**
 * Calculate confidence score based on multiple signals
 * Improved calibration for 80%+ accuracy alignment
 */
function calculateConfidence(result, allResults) {
    if (!result) return 0;

    let confidence = 0;

    // Base confidence from hybrid score (stronger weighting)
    confidence += result.hybrid_score * 60;

    // Multi-stage signal boosting
    // Stage 1: Semantic similarity (primary signal)
    if (result.semantic_score > 0.75) {
        confidence += 25;
    } else if (result.semantic_score > 0.6) {
        confidence += 15;
    } else if (result.semantic_score > 0.4) {
        confidence += 5;
    }

    // Stage 2: Keyword matching (secondary signal)
    if (result.keyword_score > 0.7) {
        confidence += 15;
    } else if (result.keyword_score > 0.4) {
        confidence += 8;
    }

    // Stage 3: Re-ranking score (tertiary signal)
    if (result.rerank_score) {
        if (result.rerank_score > 0.8) {
            confidence += 15;
        } else if (result.rerank_score > 0.6) {
            confidence += 8;
        }
    }

    // Stage 4: Priority boost for curated content
    if (result.priority && result.priority >= 100) {
        confidence += 10; // Boost for self-description and high-priority chunks
    }

    // Stage 5: Gap analysis - penalize if not clearly best
    if (allResults.length > 1) {
        const secondBest = allResults[1];
        const gap = result.hybrid_score - secondBest.hybrid_score;

        if (gap < 0.05) {
            confidence -= 15; // Penalty for very ambiguous results
        } else if (gap < 0.1) {
            confidence -= 5;
        } else if (gap > 0.3) {
            confidence += 10; // Bonus for clear winner
        }
    }

    // Stage 6: Multi-result consensus (if top results agree, boost confidence)
    if (allResults.length >= 3) {
        const top3Avg = (allResults[0].hybrid_score + allResults[1].hybrid_score + allResults[2].hybrid_score) / 3;
        if (result.hybrid_score >= top3Avg + 0.15) {
            confidence += 10; // Clear winner bonus
        }
    }

    return Math.max(0, Math.min(100, confidence));
}

/**
 * Log user question to database with answer source tracking
 * @param {string} agentId - Agent UUID
 * @param {string} question - User's question
 * @param {string} answer - Answer given
 * @param {number} confidence - Confidence score
 * @param {boolean} wasSuccessful - Whether answer was successful
 * @param {string} answerSource - Source of answer (qa_exact, qa_semantic, vector_search, fallback)
 */
async function logUserQuestion(agentId, question, answer, confidence, wasSuccessful, answerSource = 'vector_search') {
    try {
        const fetch = require('node-fetch');
        await fetch('http://localhost:8080/api/user-questions/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: agentId,
                question: question,
                answer_given: answer,
                confidence: confidence,
                was_successful: wasSuccessful,
                answer_source: answerSource
            })
        }).catch(err => console.error('Failed to log question:', err.message));
    } catch (logError) {
        // Don't fail retrieval if logging fails
        console.error('Error logging question:', logError.message);
    }
}

/**
 * Best RAG retrieval with 3-tier strategy (Q&A → Vector → Fallback)
 * @param {string} agentId - Agent UUID
 * @param {string} userQuestion - User's question
 * @returns {Promise<{success: boolean, answer: string, confidence?: number, similarity?: number, sourceUrl?: string, source?: string}>}
 */
async function retrieveAnswer(agentId, userQuestion) {
    try {
        console.log('🔍 3-Tier RAG retrieval for:', userQuestion);

        if (!agentId) {
            return {
                success: false,
                answer: "I don't have that information.",
                confidence: 0,
                source: 'fallback'
            };
        }

        // Check cache
        const cacheKey = `${agentId}:${userQuestion.toLowerCase().trim()}`;
        const cached = queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('💾 Cache hit');
            return cached.result;
        }

        // ========== TIER 1 & 2: CHECK Q&A PAIRS FIRST ========== ✨ NEW
        console.log('🎯 TIER 1-2: Checking Q&A pairs...');
        const qaResult = await checkQAPairs(agentId, userQuestion);

        if (qaResult.found) {
            console.log(`✅ Q&A Match Found (${qaResult.source}): ${(qaResult.similarity * 100).toFixed(1)}%`);

            const result = {
                success: true,
                answer: qaResult.answer,
                confidence: qaResult.confidence,
                similarity: qaResult.similarity,
                source: qaResult.source,
                sourceUrl: null
            };

            // Log to user_questions table
            await logUserQuestion(agentId, userQuestion, qaResult.answer, qaResult.confidence, true, qaResult.source);

            // Cache result
            queryCache.set(cacheKey, { result, timestamp: Date.now() });

            return result;
        }

        console.log('⏩ No Q&A match, proceeding to vector search...');

        // ========== TIER 3: VECTOR SEARCH (EXISTING CODE) ==========
        console.log('🔎 TIER 3: Vector search in document chunks...');

        // 1. Multi-query retrieval with hybrid search
        let results = await multiQueryRetrieval(agentId, userQuestion);

        if (results.length === 0) {
            console.log('⚠️ No relevant content found in vector search');

            // Get custom fallback message if available
            let fallbackMsg = "I don't have that information in my knowledge base.";
            try {
                const supabase = getSupabase();
                const { data: agent, error } = await supabase
                    .from('agents')
                    .select('fallback_message')
                    .eq('id', agentId)
                    .single();

                if (!error && agent?.fallback_message) {
                    fallbackMsg = agent.fallback_message;
                }
            } catch (err) {
                // Use default fallback if query fails
                console.log('   Using default fallback message');
            }

            const result = {
                success: false,
                answer: fallbackMsg,
                confidence: 0,
                source: 'fallback'
            };

            // Log fallback
            await logUserQuestion(agentId, userQuestion, fallbackMsg, 0, false, 'fallback');

            // Cache negative result
            queryCache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }

        // 2. Re-rank results
        results = await rerankResults(userQuestion, results);

        // 3. Get best result
        const topMatch = results[0];
        const confidence = calculateConfidence(topMatch, results);

        console.log(`✅ Vector match found:`);
        console.log(`   Semantic: ${Math.round(topMatch.semantic_score * 100)}%`);
        console.log(`   Keyword: ${Math.round(topMatch.keyword_score * 100)}%`);
        console.log(`   Hybrid: ${Math.round(topMatch.hybrid_score * 100)}%`);
        console.log(`   Confidence: ${confidence}%`);
        console.log(`   Source: ${topMatch.source_url}`);

        // 4. Extract answer with sentence-level precision
        let answer = await extractAnswer(userQuestion, topMatch.chunk_text, topMatch.semantic_score);

        // 5. Confidence-based fallback
        if (confidence < 25) {
            // Get custom fallback message
            let fallbackMsg = "I don't have that information in my knowledge base.";
            try {
                const supabase = getSupabase();
                const { data: agent, error } = await supabase
                    .from('agents')
                    .select('fallback_message')
                    .eq('id', agentId)
                    .single();

                if (!error && agent?.fallback_message) {
                    fallbackMsg = agent.fallback_message;
                }
            } catch (err) {
                // Use default fallback if query fails
                console.log('   Using default fallback message');
            }

            answer = fallbackMsg;
            console.log('⚠️ Low confidence, returning fallback');

            const result = {
                success: false,
                answer: fallbackMsg,
                confidence: 0,
                similarity: topMatch.semantic_score,
                source: 'fallback',
                sourceUrl: topMatch.source_url
            };

            // Log fallback
            await logUserQuestion(agentId, userQuestion, fallbackMsg, 0, false, 'fallback');

            // Cache result
            queryCache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        } else if (confidence < 45) {
            // Add uncertainty marker for medium confidence
            console.log('⚠️ Medium confidence');
        }

        const result = {
            success: confidence >= 25,
            answer: answer,
            confidence: confidence,
            similarity: topMatch.semantic_score,
            sourceUrl: topMatch.source_url,
            source: 'vector_search'
        };

        // Log user question to database with vector_search source
        await logUserQuestion(agentId, userQuestion, answer, confidence, confidence >= 25, 'vector_search');

        // Cache result
        queryCache.set(cacheKey, { result, timestamp: Date.now() });

        // Clean old cache entries (keep max 100 entries)
        if (queryCache.size > 100) {
            const oldestKey = queryCache.keys().next().value;
            queryCache.delete(oldestKey);
        }

        return result;

    } catch (error) {
        console.error('❌ Retrieval error:', error);

        const fallbackMsg = "I don't have that information.";
        await logUserQuestion(agentId, userQuestion, fallbackMsg, 0, false, 'error');

        return {
            success: false,
            answer: fallbackMsg,
            confidence: 0,
            source: 'error'
        };
    }
}

/**
 * Store crawled content with enhanced chunking
 * Uses proper schema: agents → knowledge_bases → document_chunks
 */
async function storeKnowledge(agentId, pages, agentName = 'Voice Agent', websiteUrl = '') {
    const { enhancedChunkText } = require('./firecrawl');
    const supabase = getSupabase();
    let totalChunks = 0;

    try {
        // 1. Create or get knowledge_base for this agent
        console.log(`🗄️ Creating knowledge base for agent ${agentId}`);

        // Check if knowledge base already exists
        let { data: existingKb } = await supabase
            .from('knowledge_bases')
            .select('*')
            .eq('agent_id', agentId)
            .single();

        let kb;
        if (existingKb) {
            console.log(`♻️ Reusing existing knowledge base: ${existingKb.id}`);
            // Update status to processing
            await supabase
                .from('knowledge_bases')
                .update({
                    source_url: websiteUrl || pages[0]?.url || 'unknown',
                    status: 'processing'
                })
                .eq('id', existingKb.id);
            kb = existingKb;
        } else {
            // Create new knowledge base
            const { data: newKb, error: kbError } = await supabase
                .from('knowledge_bases')
                .insert({
                    agent_id: agentId,
                    source_url: websiteUrl || pages[0]?.url || 'unknown',
                    status: 'processing'
                })
                .select()
                .single();

            if (kbError) {
                console.error('❌ Failed to create knowledge base:', kbError.message);
                throw new Error(`Failed to create knowledge base: ${kbError.message}`);
            }
            kb = newKb;
        }

        console.log(`✅ Knowledge base ready: ${kb.id}`);

        // 2. Add self-description as high-priority chunk
        if (agentName && websiteUrl) {
            console.log(`📝 Adding self-description for ${agentName}`);
            await addAgentSelfDescription(kb.id, agentName, websiteUrl);
            totalChunks++;
        }

        // 3. Process and store website pages
        for (const page of pages) {
            console.log(`📄 Processing: ${page.title || page.url}`);

            // Use enhanced chunking with overlap
            const chunks = enhancedChunkText(page.content, {
                maxChunkSize: 600,
                overlapSize: 100
            });

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                // Skip very short chunks
                if (chunk.length < 50) continue;

                const embedding = await generateEmbedding(chunk);

                // Extract keywords for metadata
                const keywords = extractKeywords(chunk);

                // Insert into document_chunks (correct table)
                const { error } = await supabase
                    .from('document_chunks')
                    .insert({
                        kb_id: kb.id,
                        content: chunk,
                        chunk_index: i,
                        source: page.url,
                        embedding: embedding,
                        keywords: keywords.slice(0, 20),
                        metadata: {
                            title: page.title,
                            page_index: pages.indexOf(page),
                            ...page.metadata
                        }
                    });

                if (error) {
                    console.error(`❌ Error storing chunk:`, error.message);
                    throw new Error(`Failed to store chunk: ${error.message}`);
                }
                totalChunks++;
            }
        }

        // 4. Mark knowledge base as ready
        await supabase
            .from('knowledge_bases')
            .update({ status: 'ready' })
            .eq('id', kb.id);

        console.log(`✅ Stored ${totalChunks} chunks for agent ${agentId}`);
        return totalChunks;

    } catch (error) {
        console.error('❌ Error in storeKnowledge:', error.message);
        throw error;
    }
}

/**
 * Add agent self-description as high-priority chunk
 */
async function addAgentSelfDescription(kbId, agentName, websiteUrl) {
    const supabase = getSupabase();

    // Improved self-description with better semantic overlap for common queries
    const selfDescription = `Tell me about yourself? I am ${agentName}, a voice assistant for ${websiteUrl}. About me: I help answer questions about myself, our services, products, pricing, business hours, and company information. Who am I? What do I do? I'm here to describe our business and assist you. My purpose is to provide information from our website. Introduce yourself? I'm ${agentName}, your virtual assistant. When you ask about me or want to know what I can help with, I'm powered by ${websiteUrl} to answer your questions. Feel free to ask me anything!`;

    const embedding = await generateEmbedding(selfDescription);

    const { error } = await supabase
        .from('document_chunks')
        .insert({
            kb_id: kbId,
            content: selfDescription,
            chunk_index: 0,
            source: websiteUrl,
            embedding: embedding,
            priority: 100, // High priority for "tell me about yourself"
            metadata: {
                type: 'self_description',
                agent_name: agentName
            }
        });

    if (error) {
        console.error(`❌ Error adding self-description:`, error.message);
    } else {
        console.log(`✅ Added self-description chunk`);
    }
}

/**
 * Clear query cache (useful for testing)
 */
function clearCache() {
    queryCache.clear();
    console.log('🗑️ Cache cleared');
}

module.exports = {
    retrieveAnswer,
    generateEmbedding,
    storeKnowledge,
    addAgentSelfDescription,
    clearCache
};
