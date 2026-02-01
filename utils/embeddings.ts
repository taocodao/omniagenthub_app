// utils/embeddings.ts

import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// Use the GPT_MODEL from environment variables or default to "gpt-4o-mini"
const GPT_MODEL = process.env.GPT_MODEL || "gpt-4o-mini";

export const INDEX_NAME = 'user-documents';

// --- Configuration Constants ---
export const CHUNK_SIZE = 1000; // approximate character limit per chunk
export const MAX_RETRIES = 3;
export const INITIAL_RETRY_DELAY = 1000; // in ms
export const BATCH_SIZE = 100;
export const DIMENSION = 1536; // for text-embedding-ada-002

// Clean text by removing HTML tags and trimming whitespace.
export function cleanText(text: string): string {
    return text.replace(/<[^>]+>/g, '').trim();
}

// Normalize a URL (remove trailing slash, lowercase).
export function normalizeUrl(url: string): string {
    return url.replace(/\/$/, '').toLowerCase();
}

// Generate a hash for a long string (e.g. URL).
export function generateHash(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
}

// Truncate text to a max word count (approximation).
export function truncateText(text: string, maxWords: number): string {
    const words = text.split(' ');
    if (words.length > maxWords) {
        return words.slice(0, maxWords).join(' ') + '...';
    }
    return text;
}

// Split text into chunks by character count.
export function splitTextIntoChunks(text: string, chunkSize: number = CHUNK_SIZE): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    for (const word of words) {
        // +1 for space between words.
        if (currentChunk.join(' ').length + word.length + 1 > chunkSize) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
        }
        currentChunk.push(word);
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }
    return chunks;
}

// Retry wrapper for async operations.
export async function retryOperation<T>(operation: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
            console.warn(`Operation failed. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

// Create an embedding for text with retry logic.
export async function embedTextWithRetry(text: string, retries = MAX_RETRIES): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text,
        });
        return response.data[0].embedding;
    } catch (error: any) {
        if (error.status === 429 && retries > 0) {
            const delay = INITIAL_RETRY_DELAY * (MAX_RETRIES - retries + 1);
            console.log(`Rate limit reached. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return embedTextWithRetry(text, retries - 1);
        }
        throw error;
    }
}

/**
 * Translate the given text into English if it is not already in English.
 * Uses the prompt:
 * "Translate the text into English if the text is not in English otherwise just return the text. The text is: '{text}'"
 * and uses the GPT_MODEL defined above.
 */
export async function translateToEnglish(text: string): Promise<string> {
    const prompt = `Translate the text into English if the text is not in English otherwise just return the text. The text is: "${text}"`;
    try {
        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: "system", content: "You are a translation assistant." },
                { role: "user", content: prompt }
            ],
            max_tokens: 100,
            temperature: 0,
        });
        const content = completion.choices[0]?.message?.content;
        return content ? content.trim() : text;
    } catch (error) {
        console.error("Translation error:", error);
        return text; // Fallback: return the original text if translation fails.
    }
}

/**
 * Create and store embeddings for a given text.
 * - Translates the entire text into English first.
 * - Splits the translated text into chunks.
 * - Converts each chunk to an embedding and upserts them into Pinecone.
 *
 * For uploads, the sourceId is set as "upload:{uploadName}" and version is left undefined,
 * so that each vector is stored with an ID in the form "upload:{uploadName}-{chunkIndex}".
 * The namespace used for upsert is the sourceId.
 *
 * @param userId - The uploader’s user ID.
 * @param sourceId - A unique identifier for the content source (for uploads, "upload:{uploadName}").
 * @param textContent - The text content to embed.
 * @param version - For scraped content, a version (e.g. timestamp) is provided; for uploads, leave undefined.
 * @param deletePrevious - For website scraping, if true, indicates that prior vectors (by version) are obsolete.
 */
export async function createAndStoreEmbeddings(
    userId: string,
    sourceId: string,
    textContent: string,
    version?: number,
    deletePrevious: boolean = false
): Promise<void> {
    const idx = pinecone.Index(INDEX_NAME);
    if (deletePrevious) {
        console.log(`Deletion requested for source "${sourceId}", but Pinecone does not support deletion. Relying on versioning.`);
    }
    // First translate the entire text into English.
    const translatedText = await translateToEnglish(textContent);
    console.log(`[${new Date().toISOString()}] Translated full text: ${translatedText}`);

    // Then split the translated text into chunks.
    const chunks = splitTextIntoChunks(translatedText);
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const embeddingPromises = batch.map(async (chunk, idx2) => {
            // Log the individual chunk (optional)
            console.log(`[${new Date().toISOString()}] Embedding chunk: ${chunk}`);
            const embedding = await embedTextWithRetry(chunk);
            // For uploads, version is undefined so vectorId = `${sourceId}-{chunkIndex}`
            const vectorId = version !== undefined ? `${sourceId}-${version}-${i + idx2}` : `${sourceId}-${i + idx2}`;
            return {
                id: vectorId,
                values: embedding,
                metadata: {
                    content: chunk,
                    source: sourceId,
                    chunkIndex: i + idx2,
                    timestamp: Date.now(),
                    ...(version !== undefined && { version }),
                },
            };
        });
        const vectors = await Promise.all(embeddingPromises);
        // Use sourceId as the namespace.
        await retryOperation(() => idx.namespace(sourceId).upsert(vectors));
        console.log(`[${new Date().toISOString()}] Upserted ${vectors.length} vectors for source "${sourceId}" in namespace "${sourceId}".`);
    }
}
