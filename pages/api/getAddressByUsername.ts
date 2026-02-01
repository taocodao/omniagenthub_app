// pages/api/getAddressByUsername.ts
/**
 * Get wallet address by username (case-insensitive)
 * 
 * This scans all userName:{address} keys to find matching usernames
 * 
 * Example: GET /api/getAddressByUsername?username=eric
 * Returns: { success: true, address: "0x...", username: "Eric" }
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { username } = req.method === 'GET' ? req.query : req.body;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({ success: false, error: 'Username is required' });
    }

    const searchName = username.toLowerCase().trim();
    console.log(`[getAddressByUsername] Searching for username: "${searchName}"`);

    try {
        // Scan all userName:* keys
        // Scan all userName:* keys
        const keys: string[] = [];
        let cursor = "0";

        do {
            const result = await kv.scan(cursor, { match: 'userName:*', count: 100 });
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor !== "0");

        console.log(`[getAddressByUsername] Found ${keys.length} userName keys`);

        // Check each key for matching username
        for (const key of keys) {
            const storedName = await kv.get<string>(key);
            if (storedName && storedName.toLowerCase().trim() === searchName) {
                // Extract address from key (format: userName:{address})
                const address = key.replace('userName:', '');
                console.log(`[getAddressByUsername] Found match: "${storedName}" -> ${address}`);
                return res.status(200).json({
                    success: true,
                    address,
                    username: storedName
                });
            }
        }

        console.log(`[getAddressByUsername] No match found for "${searchName}"`);
        return res.status(404).json({
            success: false,
            error: `Username "${username}" not found`
        });

    } catch (error) {
        console.error('[getAddressByUsername] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
