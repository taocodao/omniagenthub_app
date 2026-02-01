import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const KV_REST_API_URL = process.env.KV_REST_API_URL!;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN!;

const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
});

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { threadId, questions } = req.body;

    if (!threadId || !questions) {
        res.status(400).json({ error: 'Missing threadId or questions' });
        return;
    }

    try {
        await kv.set(`questions:${threadId}`, JSON.stringify(questions));
        res.status(200).json({ message: 'Questions saved successfully' });
    } catch (error) {
        console.error('Error saving questions:', error);
        res.status(500).json({ error: 'Error saving questions' });
    }
};
