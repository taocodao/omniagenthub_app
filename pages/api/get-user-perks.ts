// pages/api/get-user-perks.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,    // Ensure this environment variable is set
    token: process.env.KV_REST_API_TOKEN!, // Ensure this environment variable is set
});

// Define the structure of the request
interface GetUserPerksRequest {
    userAddress: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Allow only GET requests
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Extract userAddress from query parameters
    const { userAddress } = req.query as { userAddress: string };

    // Validate userAddress
    if (!userAddress || typeof userAddress !== 'string') {
        return res.status(400).json({ message: 'Invalid or missing user address.' });
    }

    try {
        // Hash the userAddress to create a consistent key format for KV store
        const hashedUserAddress = HashUtil.hashTo(userAddress);

        // Define KV store keys for each perk
        const freeTradesKey = `${hashedUserAddress}:freeTrades`;
        const freeUploadsKey = `${hashedUserAddress}:freeUploads`;
        const freeWebScrapeKey = `${hashedUserAddress}:freeWebScrape`;

        // Fetch the current balances concurrently
        const usdcBalanceKey = `${hashedUserAddress}:usdcBalance`;
        const [freeTrades, freeUploads, freeWebScrape, usdcBalance] = await Promise.all([
            kv.get<number>(freeTradesKey),
            kv.get<number>(freeUploadsKey),
            kv.get<number>(freeWebScrapeKey),
            kv.get<string>(usdcBalanceKey),
        ]);

        // Respond with the retrieved balances, defaulting to 0 if not set
        return res.status(200).json({
            freeTrades: freeTrades !== null ? Number(freeTrades) : 0,
            freeUploads: freeUploads !== null ? Number(freeUploads) : 0,
            freeWebScrape: freeWebScrape !== null ? Number(freeWebScrape) : 0,
            usdcBalance: usdcBalance ?? '0.00',
        });
    } catch (error: any) {
        console.error('Error retrieving user perks:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}
