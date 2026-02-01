import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userAddress } = req.query;

    if (!userAddress || typeof userAddress !== 'string') {
        return res.status(400).json({ error: 'Invalid user address' });
    }

    try {
        const language = await kv.get(`user_language:${userAddress}`);
        res.status(200).json({ language: language || 'English' });
    } catch (error) {
        console.error('Error fetching user language:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
