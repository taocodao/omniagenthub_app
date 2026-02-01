// pages/api/get-role-mappings.ts

require('dotenv').config(); // Load environment variables
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

/**
 * Look up wallet address by username (case-insensitive)
 * Scans all userName:{address} keys to find matching username
 */
async function getAddressByUsername(username: string): Promise<string | null> {
    if (!username) return null;

    const searchName = username.toLowerCase().trim();
    console.log(`[get-role-mappings] Looking up wallet address for user: "${searchName}"`);

    try {
        // Scan all userName:* keys
        const keys: string[] = [];
        let cursor: string | number = 0;
        let count = 0;
        const MAX_SCAN = 2000; // Safety limit

        do {
            const result = await kv.scan(cursor, { match: 'userName:*', count: 100 });
            cursor = result[0];
            keys.push(...result[1]);
            count += result[1].length;

            // Safety break
            if (count > MAX_SCAN) {
                console.log(`[get-role-mappings] Hit scan limit of ${MAX_SCAN} keys`);
                break;
            }
        } while (cursor !== "0");

        // Check each key for matching username
        for (const key of keys) {
            const storedName = await kv.get<string>(key);
            if (storedName && storedName.toLowerCase().trim() === searchName) {
                // Extract address from key (format: userName:{address})
                const address = key.replace('userName:', '');
                console.log(`[get-role-mappings] Found address for "${searchName}": ${address}`);
                return address;
            }
        }

        console.log(`[get-role-mappings] No address found for user "${searchName}"`);
        return null;
    } catch (error) {
        console.error('[get-role-mappings] Error looking up address:', error);
        return null;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { department, role } = req.body;

    if (!department || !role) {
        console.error('Missing department or role');
        return res.status(400).json({ message: 'Department and Role are required' });
    }

    const key = `${department}:${role}`;

    try {
        const apiKey = await kv.get(`${key}:APIkey`);
        const user = await kv.get(`${key}:user`);
        const price = await kv.get(`${key}:price`);
        const image = await kv.get(`${key}:image`);
        let userAddress = await kv.get(`${key}:userAddress`);

        // If userAddress is not set but user is provided, look up the wallet address
        if (!userAddress && user) {
            const lookupAddress = await getAddressByUsername(String(user));
            if (lookupAddress) {
                userAddress = lookupAddress;
                console.log(`[get-role-mappings] Auto-resolved user "${user}" to address: ${userAddress}`);
            }
        }

        console.log(`[get-role-mappings] Retrieved data for ${key}:`, { user, price, userAddress });

        const data = {
            apiKey: apiKey ? String(apiKey) : null,
            user: user ? String(user) : null,
            price: price ? Number(price) : null,
            image: image ? String(image) : null,
            userAddress: userAddress ? String(userAddress) : null,
        };

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error retrieving role mappings from KV database:', error);
        return res.status(500).json({ message: 'Error retrieving role mappings from KV database.' });
    }
}
