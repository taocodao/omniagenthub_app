import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { userKey, referrerId } = req.body;

    if (!userKey) {
        return res.status(400).json({ success: false, message: 'Missing userKey parameter' });
    }

    try {
        const hashedUserKey = HashUtil.hashTo(userKey);
        const referrerKey = `${hashedUserKey}:referrer`;
        const existingReferrer = await kv.get(referrerKey);

        // Check if the user already has a referrer
        if (existingReferrer) {
            return res.status(200).json({
                success: true,
                hasReferrer: true,
                isValidReferrer: false,  // Not relevant if they already have a referrer
                message: 'User already has a referrer'
            });
        }

        // Validate that the referrer is a real account with free trades
        if (referrerId) {
            // Check if the referrer account has free trades (is valid)
            const freeTrades = await kv.get(`${referrerId}:freeTrades`);

            return res.status(200).json({
                success: true,
                hasReferrer: false,
                isValidReferrer: freeTrades !== null,
                message: freeTrades !== null ? 'Valid referrer' : 'Invalid referrer account'
            });
        }

        return res.status(200).json({
            success: true,
            hasReferrer: false,
            isValidReferrer: false,
            message: 'No referrer information provided'
        });
    } catch (error) {
        console.error('Error checking referrer:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
