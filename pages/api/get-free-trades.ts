import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { userAddress } = req.body;

    if (!userAddress) {
        return res.status(400).json({ message: 'User address is required' });
    }

    try {
        const userKey = HashUtil.hashTo(userAddress);
        // Read from webaiCredits key (new system) instead of freeTrades (old system)
        const webaiCredits = await kv.get(`${userKey}:webaiCredits`);
        // Return 0 if null, not -0.01 (that was a sentinel value causing display issues)
        const responseFreeTrades = webaiCredits !== null ? Number(webaiCredits) : 0;
        return res.status(200).json({ freeTrades: responseFreeTrades });
    } catch (error) {
        console.error('Error fetching free trades:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
