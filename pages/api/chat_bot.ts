// pages/api/chatbot.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { createClient } from '@vercel/kv';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index("user-documents");
const GPT_MODEL = process.env.GPT_MODEL || "gpt-4o-mini";
//const GPT_MODEL = "o3-mini";
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

/**
 * Embed the given text using OpenAI.
 */
async function embedText(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
    });
    return response.data[0].embedding;
}

/**
 * Retrieve the selected sources (namespaces) for a given user from KV.
 */
async function getSelectedSources(userId: string): Promise<string[]> {
    const key = `selectedSources1:${userId}`;
    const data = await kv.get(key);
    const sources = data ? (data as string[]) : [];
    console.log(`[chatbot] Retrieved selected sources for ${userId}: ${JSON.stringify(sources)}`);
    return sources;
}

/**
 * Combine the user's default namespace (their userId) with any selected sources.
 */
function getNamespaces(userId: string, selectedSources: string[]): string[] {
    const nsSet = new Set<string>([userId, ...selectedSources]);
    return Array.from(nsSet);
}

/**
 * Query multiple namespaces (selected embeddings) to fetch updated context.
 */
async function fetchUpdatedContextFromNamespaces(namespaces: string[], questionEmbedding: number[]): Promise<string> {
    let allMatches: any[] = [];
    for (const ns of namespaces) {
        const response = await index.namespace(ns).query({
            vector: questionEmbedding,
            topK: 20,
            includeMetadata: true,
            filter: { content: { $exists: true } },
        });
        if (response.matches) {
            allMatches.push(...response.matches);
        }
    }
    console.log(`[chatbot] Total matches from namespaces ${JSON.stringify(namespaces)}: ${allMatches.length}`);
    // Group matches by source (if available)
    const grouped: { [source: string]: any[] } = {};
    for (const match of allMatches) {
        const meta = match.metadata as any;
        if (meta.source) {
            if (!grouped[meta.source]) grouped[meta.source] = [];
            grouped[meta.source].push(match);
        }
    }
    let selectedMatches: any[] = [];
    for (const source in grouped) {
        const matches = grouped[source];
        if (matches.some(m => (m.metadata as any).version !== undefined)) {
            const maxVersion = Math.max(...matches.map(m => (m.metadata as any).version));
            selectedMatches = selectedMatches.concat(matches.filter(m => (m.metadata as any).version === maxVersion));
        } else {
            selectedMatches = selectedMatches.concat(matches);
        }
    }
    const context = selectedMatches.map(match => (match.metadata as any).content).join("\n");
    console.log(`[chatbot] Combined context length: ${context.length}`);
    return context;
}

/**
 * Generate an answer using OpenAI's Chat completions.
 */
async function generateAnswer(question: string, context: string): Promise<string> {
    const prompt = `Context: ${context}\n\nQuestion: ${question}\n\nAnswer:`;
    const completion = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
            {
                role: "system",
                content:
                    //"You are a highly knowledgeable and creative assistant. Using the provided context—which is derived from the selected namespace knowledge (scraped website content and uploaded text)—generate a comprehensive and thoughtful answer to the user's question. If the provided context is insufficient, ask clarifying questions and guide the user towards finding the answer."
                    "You are a highly knowledgeable and creative assistant. Using the provided context—which is derived from the selected namespace knowledge (scraped website content and uploaded text)—generate a comprehensive and thoughtful answer to the user's question. If the provided context is insufficient, ask clarifying questions and also guide the user towards finding the answer."
            },
            { role: "user", content: prompt }
        ],
        max_tokens: 650,
        temperature: 0.6,
    });
    const answer = completion.choices[0].message?.content;
    console.log(`[chatbot] Generated answer: ${answer}`);
    return answer ? answer.trim() : "Sorry, I couldn't generate an answer.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { userId, question } = req.body as { userId: string; question: string };
        if (!userId || !question) {
            return res.status(400).json({ message: "Missing userId or question" });
        }

        const selectedSources = await getSelectedSources(userId);
        const namespaces = getNamespaces(userId, selectedSources);
        console.log(`[chatbot] Using namespaces: ${JSON.stringify(namespaces)}`);

        const questionEmbedding = await embedText(question);
        const context = await fetchUpdatedContextFromNamespaces(namespaces, questionEmbedding);
        const answer = await generateAnswer(question, context);

        return res.status(200).json({ answer });
    } catch (error) {
        console.error("[chatbot] Error:", error);
        return res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
    }
}
