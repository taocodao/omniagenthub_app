import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, language } = req.body;

    if (!name || !language || typeof name !== 'string' || typeof language !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        const content = await kv.get(`content:${name}:${language}`);
        res.status(200).json({ content: content || null });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
