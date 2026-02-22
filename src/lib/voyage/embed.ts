// Voyage AI Embeddings — REST API client
// Model: voyage-3.5-lite (1024 dimensions)

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3.5-lite';
const VOYAGE_BATCH_SIZE = 128;

if (!VOYAGE_API_KEY) {
  console.warn('⚠️ VOYAGE_API_KEY not configured');
}

export type EmbedInputType = 'document' | 'query';

/**
 * Embed multiple texts using Voyage AI.
 * Automatically batches requests (max 128 texts per API call).
 *
 * @param texts - Array of text strings to embed
 * @param inputType - 'document' for indexing, 'query' for searching
 * @returns Array of embedding vectors (1024 dimensions each)
 */
export async function embedTexts(
  texts: string[],
  inputType: EmbedInputType
): Promise<number[][]> {
  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY not configured');
  }

  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
    const batch = texts.slice(i, i + VOYAGE_BATCH_SIZE);

    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        response = await fetch(VOYAGE_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VOYAGE_API_KEY}`,
          },
          body: JSON.stringify({
            model: VOYAGE_MODEL,
            input: batch,
            input_type: inputType,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok || (response.status < 429 && response.status !== 408)) break;
      if (attempt === 0) {
        console.warn(`[Voyage Embed] Retrying after ${response.status}...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!response || !response.ok) {
      const errorBody = response ? await response.text() : 'Request aborted';
      throw new Error(
        `Voyage AI API error ${response?.status ?? 'timeout'}: ${errorBody}`
      );
    }

    const data = await response.json();

    // data.data is an array of { object, embedding, index }
    const embeddings = data.data
      .sort(
        (a: { index: number }, b: { index: number }) => a.index - b.index
      )
      .map((item: { embedding: number[] }) => item.embedding);

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Embed a single query string for similarity search.
 *
 * @param query - The search query to embed
 * @returns Single embedding vector (1024 dimensions)
 */
export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query], 'query');
  return embedding;
}
