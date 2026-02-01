import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface TransferRequest {
    recipientId: string;
    freeTrades?: number;
    freeUploads?: number;
    freeWebScrape?: number;
    source?: string;
}

// Define interface for updated balances object
interface UpdatedBalances {
    freeTrades?: number;
    freeUploads?: number;
    freeWebScrape?: number;
}

// Safe increment helper function
async function safeIncrement(key: string, incrementBy: number): Promise<number> {
    try {
        // Try direct increment first
        return await kv.incrby(key, incrementBy);
    } catch (error: any) {
        // If we get a "not an integer" error, fix it and retry
        if (error.message && error.message.includes('not an integer or out of range')) {
            // Get current value
            const currentValue = await kv.get(key);

            // Convert to integer (default to 0 if not a number)
            let intValue = 0;
            if (currentValue !== null) {
                // Parse as float first, then round to integer
                const floatValue = parseFloat(String(currentValue));
                intValue = isNaN(floatValue) ? 0 : Math.round(floatValue);
            }

            // Set the integer value in Redis
            await kv.set(key, intValue);

            // Now try the increment again
            return await kv.incrby(key, incrementBy);
        }
        // Rethrow any other errors
        throw error;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { recipientId, freeTrades, freeUploads, freeWebScrape, source } = req.body as TransferRequest;

    if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Missing recipientId parameter' });
    }

    try {
        // Initialize with the proper type
        const updatedBalances: UpdatedBalances = {};

        if (freeTrades && freeTrades > 0) {
            const freeTradesKey = `${recipientId}:freeTrades`;
            updatedBalances.freeTrades = await safeIncrement(freeTradesKey, freeTrades);
        }

        if (freeUploads && freeUploads > 0) {
            const freeUploadsKey = `${recipientId}:freeUploads`;
            updatedBalances.freeUploads = await safeIncrement(freeUploadsKey, freeUploads);
        }

        if (freeWebScrape && freeWebScrape > 0) {
            const freeWebScrapeKey = `${recipientId}:freeWebScrape`;
            updatedBalances.freeWebScrape = await safeIncrement(freeWebScrapeKey, freeWebScrape);
        }

        return res.status(200).json({
            success: true,
            message: 'Perks transferred successfully',
            updatedBalances
        });
    } catch (error) {
        console.error('Error transferring perks:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
