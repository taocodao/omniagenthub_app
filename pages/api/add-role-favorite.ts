import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { userAddress, department, role } = req.body;

    if (!userAddress || !department || !role) {
        return res.status(400).json({ message: 'User address, department, and role are required' });
    }

    const key = `favoriteRole:${userAddress}:${department}:${role}`;

    try {
        await kv.set(key, true);
        return res.status(200).json({ message: 'Role favorited successfully' });
    } catch (error) {
        console.error('Error adding role favorite to KV database:', error);
        return res.status(500).json({ message: 'Error adding role favorite to KV database.' });
    }
}
