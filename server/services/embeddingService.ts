import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config';

const EMBEDDING_MODEL = 'text-embedding-004';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
    if (!client) {
        if (!serverConfig.geminiApiKey) {
            throw new Error('Missing GOOGLE_API_KEY for embedding service.');
        }
        client = new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
    }
    return client;
}

/**
 * Embed a text string using text-embedding-004.
 * Returns a float32 vector of 768 dimensions.
 */
export async function embedText(text: string): Promise<number[]> {
    const ai = getClient();
    const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
    });

    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
        throw new Error('Embedding returned no values.');
    }

    return values;
}

/**
 * Compute cosine similarity between two float32 vectors.
 * Returns a value in [-1, 1] where 1 = identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
        return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
