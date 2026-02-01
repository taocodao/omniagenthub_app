import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const isValidJSON = (str: string) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { department, role, userAddress } = req.body;

    if (!department || !role) {
        return res.status(400).json({ message: 'Department and Role are required' });
    }

    // Handle "Favorite Task" role specially
    if (role === "Favorite Task") {
        if (!userAddress) {
            return res.status(400).json({ message: 'User address is required for Favorite Task role' });
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

            return res.status(200).json({ tasks: favoriteTasks });
        } catch (error) {
            console.error('Error fetching favorite tasks from KV database:', error);
            return res.status(500).json({ message: 'Error fetching favorite tasks from KV database.' });
        }
    }

    // Original logic for regular roles
    const roleTasksKey = `department:${department}:role:${role}:tasks`;

    try {
        const tasks: string[] = await kv.get(roleTasksKey).then((res: any) => {
            console.log(`Tasks fetched for key ${roleTasksKey}:`, res);
            if (res === null || res === undefined) {
                return [];
            } else if (Array.isArray(res)) {
                return res;
            } else if (typeof res === 'string' && isValidJSON(res)) {
                return JSON.parse(res);
            } else {
                console.warn(`Invalid data for key ${roleTasksKey}: ${res}`);
                return [];
            }
        });

        return res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks from KV database:', error);
        return res.status(500).json({ message: 'Error fetching tasks from KV database.' });
    }
}
