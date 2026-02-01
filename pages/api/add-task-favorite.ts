// pages/api/add-task-favorite.ts

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

    const { userAddress, department, role, task } = req.body;

    if (!userAddress || !department || !role || !task) {
        return res.status(400).json({ message: 'User address, department, role, and task are required' });
    }

    const key = `favoriteTask:${userAddress}:${department}:${role}:${task}`;

    try {
        await kv.set(key, true);
        return res.status(200).json({ message: 'Task favorited successfully' });
    } catch (error) {
        console.error('Error adding task favorite to KV database:', error);
        return res.status(500).json({ message: 'Error adding task favorite to KV database.' });
    }
}
