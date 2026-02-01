// pages/api/reset-webai-credits.ts
// Temporary API to reset WEBAI credits for testing - DELETE after testing
// Only works in dev mode

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow in dev mode and from localhost
    const configEnv = process.env.NEXT_PUBLIC_CONFIG_ENV || 'prod';
    if (configEnv !== 'dev' && !req.headers.host?.includes('localhost')) {
        return res.status(403).json({ success: false, message: 'Only available in dev mode' });
    }

    const { userAddress, promoCode } = req.body;

    if (!userAddress) {
        return res.status(400).json({ success: false, message: 'userAddress is required' });
    }

    try {
        const userKey = HashUtil.hashTo(userAddress);

        // Reset WEBAI credits to 0
        await kv.set(`${userKey}:webaiCredits`, 0);

        // Also clear the promo code usage if provided
        if (promoCode) {
            // Clear global promo usage
            await kv.del(`global:promo:${promoCode}`);
        }

        return res.status(200).json({
            success: true,
            message: 'WEBAI credits reset to 0',
            userKey: userKey,
        });
    } catch (error) {
        console.error('Error resetting credits:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
