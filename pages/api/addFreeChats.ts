// pages/api/addFreeChats.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

type Data = {
    message: string;
    success: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    const { userKey, usedFreeChats } = req.body;

    // Validate input
    if (!userKey || usedFreeChats === undefined || usedFreeChats < 0) {
        return res.status(400).json({
            message: "Missing or invalid required parameters. 'usedFreeChats' must be a non-negative number.",
            success: false
        });
    }

    try {
        // Fetch current free trades
        let currentFreeTrades = await kv.get(`${userKey}:freeTrades`) as number;
        currentFreeTrades = currentFreeTrades ? Number(currentFreeTrades) : 0;

        // Add back the used free chats
        const updatedFreeTrades = currentFreeTrades + usedFreeChats;
        await kv.set(`${userKey}:freeTrades`, updatedFreeTrades);

        return res.status(200).json({
            message: "Free chats added back successfully.",
            success: true
        });
    } catch (error) {
        console.error('Error in addFreeChats:', error);
        return res.status(500).json({
            message: 'Internal server error.',
            success: false
        });
    }
}
