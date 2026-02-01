// pages/api/get-translated-names.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse<string[] | { error: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Fetch all keys that start with 'content:label:'
        const keys = await scanAllKeys('content:label:*');

        // Extract unique names from the keys
        const names = new Set<string>();
        keys.forEach((key: string) => {
            const parts = key.split(':');
            if (parts.length > 2) {
                // parts[1] is 'label', parts[2] is the actual name (e.g., 'shareMessage')
                // Combining them to maintain consistency with 'label:shareMessage'
                names.add(`${parts[1]}:${parts[2]}`);
            }
        });

        // Convert Set to Array
        const uniqueNames = Array.from(names);

        res.status(200).json(uniqueNames);
    } catch (error) {
        console.error('Error fetching translated names:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
