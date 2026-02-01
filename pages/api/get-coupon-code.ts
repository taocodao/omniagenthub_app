// pages/api/get-coupon-code.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { accountAddress } = req.query;

    if (!accountAddress || typeof accountAddress !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid or missing account address.' });
    }

    try {
        const hashedAddress = HashUtil.hashTo(accountAddress);
        // Pattern to search for all coupon codes for this account
        const pattern = `${hashedAddress}:coupon:*`;

        // Get all keys matching the pattern
        const keys = await scanAllKeys(pattern);

        // If no keys found, return empty object
        if (!keys || keys.length === 0) {
            return res.status(200).json({ success: true, coupons: {} });
        }

        // Process each key to extract product ID and get corresponding discount
        const coupons: Record<string, number> = {};

        for (const key of keys) {
            // Extract product ID from key (format: hashedAddress:coupon:productId)
            const parts = key.split(':');
            if (parts.length === 3) {
                const productId = parts[2];
                const discount = await kv.get(key);
                coupons[productId] = discount as number;
            }
        }

        return res.status(200).json({ success: true, coupons });
    } catch (error) {
        console.error('Error retrieving coupon codes:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}
