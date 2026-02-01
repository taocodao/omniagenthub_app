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
        // Use SCAN instead of KEYS to avoid Upstash limitations
        const prefix = `favoriteTask:${userAddress}:${department}:`;
        const allKeys: string[] = [];
        let cursor: string = "0"; // Always use string type for cursor

        do {
            // Use SCAN command with MATCH pattern
            const result = await kv.scan(cursor, {
                match: prefix + '*',
                count: 1000 // Process 1000 keys at a time
            });

            if (Array.isArray(result) && result.length >= 2) {
                // Ensure cursor is always treated as string
                cursor = String(result[0]);
                const keys = result[1] as string[];
                allKeys.push(...keys);
            } else {
                break;
            }
        } while (cursor !== "0"); // Only compare to string "0"

        // Extract unique task names from keys
        const favoriteTasks = Array.from(new Set(
            allKeys.map(key => {
                // Extract task from key format: favoriteTask:userAddress:department:role:task
                const parts = key.split(':');
                return parts[parts.length - 1]; // Get the task name (last part)
            })
        ));

        return res.status(200).json({ favoriteTasks });
    } catch (error) {
        console.error('Error fetching all favorite tasks from KV database:', error);
        return res.status(500).json({ message: 'Error fetching all favorite tasks from KV database.' });
    }
}
