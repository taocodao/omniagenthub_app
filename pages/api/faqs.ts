// pages/api/faqs.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { createClient } from '@vercel/kv';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const GPT_MODEL = process.env.GPT_MODEL || "gpt-4o-mini";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

/**
 * Retrieve selected sources (namespaces) for a user from KV.
 */
async function getSelectedSources(userId: string): Promise<string[]> {
    const key = `selectedSources1:${userId}`;
    const data = await kv.get(key);
    return data ? (data as string[]) : [];
}

/**
 * Combine user's default namespace (their userId) with selected sources.
 */
function getNamespaces(userId: string, selectedSources: string[]): string[] {
    const nsSet = new Set<string>([userId, ...selectedSources]);
    return Array.from(nsSet);
}

/**
 * Fetch context from multiple namespaces.
 * (For simplicity, we query each namespace for a few matches and concatenate the content.)
 */
async function fetchContextFromNamespaces(namespaces: string[]): Promise<string> {
    let allContext: string[] = [];
    for (const ns of namespaces) {
        const res = await pc.index("user-documents").namespace(ns).query({
            // Use a dummy vector for a general query.
            vector: new Array(1536).fill(1 / Math.sqrt(1536)),
            topK: 5,
            includeMetadata: true,
            filter: { content: { $exists: true } },
        });
        if (res.matches) {
            const texts = res.matches.map(match => (match.metadata as any).content);
            allContext.push(texts.join("\n"));
        }
    }
    return allContext.join("\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }
    const { userId } = req.body as { userId: string };
    if (!userId) {
        return res.status(400).json({ message: "Missing userId" });
    }
    try {
        const selectedSources = await getSelectedSources(userId);
        const namespaces = getNamespaces(userId, selectedSources);
        const context = await fetchContextFromNamespaces(namespaces);
        // Compose the prompt for FAQs.
        const prompt = 'Based on the following context derived from the selected embedding knowledge:\n\n${context}\n\nPlease provide the 8 most likely questions that users might ask about this information. Consider what aspects of the content users would be most interested in, curious about, or need clarification on. Format each question starting with Q: and present them in plain text, one per line. Focus on questions that address key points, potential areas of confusion, or important details from the given context. Only provide the questions, nothing else.';
        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant that generates frequently asked questions based on provided context." },
                { role: "user", content: prompt },
            ],
            max_tokens: 200,
            temperature: 0.7,
        });
        const text = completion.choices[0]?.message?.content;
        const questions = text ? text.trim().split("\n").filter(q => q.trim() !== "") : [];
        console.log(`[faqs] Generated FAQs for ${userId}: ${JSON.stringify(questions)}`);
        res.status(200).json({ questions });
    } catch (error) {
        console.error("[faqs] Error generating FAQs:", error);
        res.status(500).json({ message: "Error generating FAQs", error: (error as Error).message });
    }
}
