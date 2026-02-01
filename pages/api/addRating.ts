import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { userAddress, department, role, rating } = req.body;

    if (!userAddress || !department || !role || rating === undefined) {
        return res.status(400).json({ message: 'User address, department, role, and rating are required' });
    }

    // Use a distinct prefix for ratings to avoid key collisions
    const key = `rating:${userAddress}:${department}:${role}`;

    try {
        await kv.set(key, rating);
        //console.log(`✅ Rating added: ${key} = ${rating}`);
        return res.status(200).json({ message: 'Rating added successfully' });
    } catch (error) {
        console.error('Error saving rating to KV database:', error);
        return res.status(500).json({ message: 'Error saving rating to KV database.' });
    }
}
