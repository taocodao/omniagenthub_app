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

    if (!userKey || !referrerId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    try {
        const hashedUserKey = HashUtil.hashTo(userKey);
        const referrerKey = `${hashedUserKey}:referrer`;

        // Check if user already has a referrer
        const existingReferrer = await kv.get(referrerKey);
        if (existingReferrer) {
            return res.status(400).json({
                success: false,
                message: 'User already has a referrer'
            });
        }

        // Save the referrer
        await kv.set(referrerKey, referrerId);

        return res.status(200).json({
            success: true,
            message: 'Referrer saved successfully'
        });
    } catch (error) {
        console.error('Error saving referrer:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
