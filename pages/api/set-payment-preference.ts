/**
 * API endpoint to set payment preference (usdc, webai, both)
 * Stores the preference in Vercel KV keyed by wallet hash
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userAddress, preference } = req.body;

    if (!userAddress || !preference) {
        return res.status(400).json({ error: 'Missing userAddress or preference' });
    }

    // Validate preference value (usd = WEBAI credits, usdc = on-chain)
    const validPreferences = ['usd', 'usdc', 'webai', 'both']; // webai/both for backward compat
    if (!validPreferences.includes(preference)) {
        return res.status(400).json({ error: 'Invalid preference. Must be: usd or usdc' });
    }

    try {
        const kv = createClient({
            url: process.env.KV_REST_API_URL!,
            token: process.env.KV_REST_API_TOKEN!
        });

        const key = HashUtil.hashTo(userAddress) + ':paymentPreference';
        await kv.set(key, preference);

        console.log(`✅ Payment preference set for ${userAddress}: ${preference}`);

        return res.status(200).json({
            success: true,
            preference,
            message: `Payment preference set to: ${preference}`
        });
    } catch (error: any) {
        console.error('Error setting payment preference:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
