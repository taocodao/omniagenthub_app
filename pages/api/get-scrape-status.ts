// pages/api/get-scrape-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { kv, scanAllKeys } from '../../utils/redis-helpers';



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the userAddress from the query parameters.
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "userAddress" query parameter' });
    }

    try {
        // List all keys with the prefix "lastScrapeVersion:<userAddress>:"
        const keys = await scanAllKeys(`lastScrapeVersion:${userAddress}:`);

        // For each key, extract the normalized URL and retrieve the website metadata.
        const statuses = await Promise.all(
            keys.map(async (key: string) => {
                // Expected key format: "lastScrapeVersion:<userId>:<normalizedUrl>"
                const parts = key.split(':');
                // Join any remaining parts to reconstruct the normalized URL
                const normalizedUrl = parts.slice(2).join(':');
                // Get the scrape version stored under this key
                const version = await kv.get(key);
                // Retrieve website metadata from key "website:<normalizedUrl>"
                const websiteMeta = await kv.get(`website:${normalizedUrl}`);
                return {
                    url: normalizedUrl,
                    scrapedAt: websiteMeta ? (websiteMeta as any).scrapedAt : null,
                    pageCount: websiteMeta ? (websiteMeta as any).pageCount : null,
                    version,
                };
            })
        );

        res.status(200).json(statuses);
    } catch (error) {
        console.error("Error fetching scrape statuses:", error);
        res.status(500).json({ error: "Error fetching scrape statuses" });
    }
}
