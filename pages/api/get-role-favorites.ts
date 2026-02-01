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

    const { userAddress, department } = req.body;

    if (!userAddress || !department) {
        return res.status(400).json({ message: 'User address and department are required' });
    }

    try {
        // Fetch all keys for favorite roles for the user and department
        const prefix = `favoriteRole:${userAddress}:${department}:`;
        const keys = await kv.keys(prefix + '*');

        // Extract role names from keys
        const favoriteRoles = keys.map(key => key.replace(prefix, ''));

        return res.status(200).json({ favoriteRoles });
    } catch (error) {
        console.error('Error fetching favorite roles from KV database:', error);
        return res.status(500).json({ message: 'Error fetching favorite roles from KV database.' });
    }
}
