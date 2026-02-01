// set_user_language.ts
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

    const { userAddress, language } = req.body;

    if (!userAddress || typeof userAddress !== 'string' || !language || typeof language !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        await kv.set(`user_language:${userAddress}`, language);
        res.status(200).json({ message: 'Language set successfully' });
    } catch (error) {
        console.error('Error setting user language:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
