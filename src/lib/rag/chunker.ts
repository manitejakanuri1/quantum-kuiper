// Text Chunker — Splits markdown into overlapping chunks for embedding
// Detects FAQ blocks, tables, and tracks section headers

export interface TextChunk {
  text: string;
  metadata: {
    sourceUrl: string;
    pageTitle: string;
    chunkIndex: number;
    sectionHeader: string;
    chunkType: 'text' | 'faq' | 'table';
  };
}

const DEFAULT_MAX_CHUNK_SIZE = 4000; // ~1024 tokens
const DEFAULT_OVERLAP_SIZE = 800; // ~20% overlap

const SEPARATORS = ['\n## ', '\n### ', '\n\n', '\n', '. ', ' '];

// Regex to detect FAQ headings (headings ending with ?)
const FAQ_HEADING_RE = /^(#{1,3})\s+(.+\?)\s*$/gm;

// Regex to detect markdown tables (lines with |---|)
const TABLE_SEPARATOR_RE = /\|[\s-]+\|/;

/**
 * Extract FAQ blocks — questions with their answers kept as atomic chunks.
 * Returns extracted FAQ chunks and the remaining text with FAQs removed.
 */
function extractFAQBlocks(
  text: string,
  sourceUrl: string,
  pageTitle: string
): { faqChunks: TextChunk[]; remainingText: string } {
  const faqChunks: TextChunk[] = [];
  let remaining = text;

  // Find all FAQ headings
  const faqMatches: { start: number; end: number; heading: string }[] = [];
  let match: RegExpExecArray | null;
  const re = /^(#{1,3})\s+(.+\?)\s*$/gm;

  while ((match = re.exec(text)) !== null) {
    faqMatches.push({
      start: match.index,
      heading: match[2],
      end: match.index + match[0].length,
    });
  }

  // For each FAQ heading, extract the heading + content until next heading of same or higher level
  for (let i = faqMatches.length - 1; i >= 0; i--) {
    const faq = faqMatches[i];
    // Find the end: next heading or end of text
    const nextHeadingMatch = remaining
      .slice(faq.end)
      .match(/\n#{1,3}\s+/);
    const blockEnd = nextHeadingMatch
      ? faq.end + nextHeadingMatch.index!
      : remaining.length;

    const faqBlock = remaining.slice(faq.start, blockEnd).trim();

    // Only extract if the block is reasonably sized (not too huge)
    if (faqBlock.length > 50 && faqBlock.length < 6000) {
      faqChunks.unshift({
        text: faqBlock,
        metadata: {
          sourceUrl,
          pageTitle,
          chunkIndex: 0, // Will be reassigned later
          sectionHeader: faq.heading,
          chunkType: 'faq',
        },
      });

      // Remove from remaining text
      remaining = remaining.slice(0, faq.start) + remaining.slice(blockEnd);
    }
  }

  return { faqChunks, remainingText: remaining };
}

/**
 * Extract markdown table blocks as atomic chunks.
 * Returns extracted table chunks and the remaining text.
 */
function extractTableBlocks(
  text: string,
  sourceUrl: string,
  pageTitle: string
): { tableChunks: TextChunk[]; remainingText: string } {
  const tableChunks: TextChunk[] = [];
  let remaining = text;

  const lines = remaining.split('\n');
  let tableStart = -1;
  let tableEnd = -1;
  let currentHeader = '';
  const tablesToExtract: { start: number; end: number; header: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Track section headers
    const headerMatch = lines[i].match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      currentHeader = headerMatch[2];
    }

    if (TABLE_SEPARATOR_RE.test(lines[i])) {
      // Found a table separator — look backward for table header row and forward for data rows
      tableStart = Math.max(0, i - 1); // Header row is typically one line before separator
      // Scan forward to find table end
      tableEnd = i + 1;
      while (tableEnd < lines.length && lines[tableEnd].trim().startsWith('|')) {
        tableEnd++;
      }

      tablesToExtract.push({
        start: tableStart,
        end: tableEnd,
        header: currentHeader,
      });

      i = tableEnd; // Skip past the table
    }
  }

  // Extract tables in reverse order to preserve indices
  for (let t = tablesToExtract.length - 1; t >= 0; t--) {
    const table = tablesToExtract[t];
    const tableLines = lines.slice(table.start, table.end);
    const tableText = tableLines.join('\n').trim();

    if (tableText.length > 30 && tableText.length < 8000) {
      tableChunks.unshift({
        text: `${table.header ? `## ${table.header}\n\n` : ''}${tableText}`,
        metadata: {
          sourceUrl,
          pageTitle,
          chunkIndex: 0, // Will be reassigned later
          sectionHeader: table.header,
          chunkType: 'table',
        },
      });

      // Remove table lines from the original text
      lines.splice(table.start, table.end - table.start);
    }
  }

  remaining = lines.join('\n');
  return { tableChunks, remainingText: remaining };
}

/**
 * Track the current section header for a given position in the text.
 */
function findSectionHeader(text: string, position: number): string {
  const before = text.slice(0, position);
  const headers = [...before.matchAll(/^(#{1,3})\s+(.+)$/gm)];
  if (headers.length === 0) return '';
  return headers[headers.length - 1][2];
}

/**
 * Recursively split text using a hierarchy of separators.
 * Tries the first separator; if pieces are still too large, recurses with the next.
 */
function recursiveSplit(
  text: string,
  separators: string[],
  maxSize: number
): string[] {
  if (text.length <= maxSize) return [text];
  if (separators.length === 0) {
    // Last resort: hard split at maxSize
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }
    return chunks;
  }

  const separator = separators[0];
  const remaining = separators.slice(1);
  const parts = text.split(separator);

  // Merge small adjacent parts back together
  const merged: string[] = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? current + separator + part : part;
    if (candidate.length > maxSize && current) {
      merged.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) merged.push(current);

  // If any chunk is still too large, recurse with next separator
  return merged.flatMap((chunk) =>
    chunk.length > maxSize ? recursiveSplit(chunk, remaining, maxSize) : [chunk]
  );
}

/**
 * Split markdown content into overlapping chunks suitable for embedding.
 * Detects FAQ blocks and tables, keeping them as atomic chunks.
 *
 * @param markdown - Raw markdown content from a crawled page
 * @param sourceUrl - URL of the source page
 * @param pageTitle - Title of the source page
 * @param options - Optional chunk size and overlap configuration
 */
export function chunkMarkdown(
  markdown: string,
  sourceUrl: string,
  pageTitle: string,
  options?: {
    maxChunkSize?: number;
    overlapSize?: number;
  }
): TextChunk[] {
  const maxChunkSize = options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const overlapSize = options?.overlapSize ?? DEFAULT_OVERLAP_SIZE;

  // Normalize whitespace
  const cleaned = markdown.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Skip very short content
  if (cleaned.length < 100) return [];

  // 1. Extract FAQ blocks (atomic — never split)
  const { faqChunks, remainingText: afterFaq } = extractFAQBlocks(
    cleaned,
    sourceUrl,
    pageTitle
  );

  // 2. Extract table blocks (atomic — never split)
  const { tableChunks, remainingText: afterTables } = extractTableBlocks(
    afterFaq,
    sourceUrl,
    pageTitle
  );

  // 3. Split remaining text into regular chunks
  const rawChunks = recursiveSplit(afterTables, SEPARATORS, maxChunkSize);

  // Apply overlap: prepend tail of previous chunk
  const textChunks: TextChunk[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    let text = rawChunks[i].trim();
    if (!text) continue;

    if (i > 0 && overlapSize > 0) {
      const prevText = rawChunks[i - 1];
      const overlap = prevText.slice(-overlapSize);
      text = overlap + text;
      // Ensure we don't exceed max size after adding overlap
      if (text.length > maxChunkSize + overlapSize) {
        text = text.slice(0, maxChunkSize + overlapSize);
      }
    }

    // Find the section header for this chunk's position (use cumulative search)
    const chunkText = rawChunks[i].trim();
    const pos = afterTables.indexOf(chunkText, i > 0 ? afterTables.indexOf(rawChunks[i - 1].trim()) : 0);
    const sectionHeader = findSectionHeader(afterTables, pos >= 0 ? pos : 0);

    textChunks.push({
      text,
      metadata: {
        sourceUrl,
        pageTitle,
        chunkIndex: 0, // Will be reassigned below
        sectionHeader,
        chunkType: 'text',
      },
    });
  }

  // 4. Combine all chunks and assign final indices
  const allChunks = [...faqChunks, ...tableChunks, ...textChunks];
  allChunks.forEach((chunk, i) => {
    chunk.metadata.chunkIndex = i;
  });

  return allChunks;
}
