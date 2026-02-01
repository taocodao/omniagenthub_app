// pages/api/get-task-favorites.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { userAddress, department, role } = req.body;

    if (!userAddress || !department || !role) {
        return res.status(400).json({ message: 'User address, department, and role are required' });
    }

    try {
        const keys = await scanAllKeys(`favoriteTask:${userAddress}:${department}:${role}:*`);
        const tasks = keys.map((key: string) => key.split(':').pop()).filter((task): task is string => task !== undefined);
        return res.status(200).json({ favoriteTasks: tasks });
    } catch (error) {
        console.error('Error fetching favorite tasks from KV database:', error);
        return res.status(500).json({ message: 'Error fetching favorite tasks from KV database.' });
    }
}
