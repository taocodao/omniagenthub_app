// pages/api/addWebaiCredits.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

type Data = {
    message: string;
    success: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    const { userKey, usedWebaiCredits } = req.body;

    // Validate input
    if (!userKey || usedWebaiCredits === undefined || usedWebaiCredits < 0) {
        return res.status(400).json({
            message: "Missing or invalid required parameters. 'usedWebaiCredits' must be a non-negative number.",
            success: false
        });
    }

    try {
        // Fetch current WEBAI Credits
        let currentCredits = await kv.get(`${userKey}:webaiCredits`) as number;
        currentCredits = currentCredits ? Number(currentCredits) : 0;

        // Add back the used credits
        const updatedCredits = currentCredits + usedWebaiCredits;
        await kv.set(`${userKey}:webaiCredits`, updatedCredits);

        return res.status(200).json({
            message: "WEBAI Credits added back successfully.",
            success: true
        });
    } catch (error) {
        console.error('Error in addWebaiCredits:', error);
        return res.status(500).json({
            message: 'Internal server error.',
            success: false
        });
    }
}
