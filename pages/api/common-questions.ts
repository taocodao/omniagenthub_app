import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { createClient } from '@vercel/kv';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const website = req.query.website as string;
        const normalizedWebsite = website.toLowerCase().replace(/\/$/, '');
        const kvKey = `CommonQuestions:${normalizedWebsite}`;

        // First check the KV database for existing common questions
        const stored = await kv.get(kvKey);
        if (stored) {
            const data = typeof stored === 'string' ? JSON.parse(stored) : stored;
            return res.status(200).json({ questions: data.questions });
        }

        // Generate embedding properly
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: "Generate common questions based on this content:"
        });
        const vector = embeddingResponse.data[0].embedding;

        const index = pinecone.Index('omnisharing');
        const pineResponse = await index.query({
            vector, // Use the extracted vector
            topK: 5,
            includeMetadata: true,
            filter: { url: { $eq: normalizedWebsite } },
        });

        const context = pineResponse.matches?.map(m => m.metadata?.text).join('\n') || '';

        const questionsResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `Generate 12 most commonly asked questions based on: ${context}, output the questions only without markdown format`
            }]
        });
        const questionsText = questionsResponse.choices[0].message.content;
        const questions = questionsText?.split('\n').filter(q => q.trim()) || [];

        // Save the generated questions with a timestamp into KV
        const dataToSave = JSON.stringify({ questions, timestamp: new Date().toISOString() });
        await kv.set(kvKey, dataToSave);

        return res.status(200).json({ questions });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
