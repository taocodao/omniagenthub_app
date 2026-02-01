// pages/api/add-coupon-code.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface AddCouponCodeRequest {
    accountAddress: string;
    productId: number;
    discountPercentage: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { accountAddress, productId, discountPercentage } = req.body as AddCouponCodeRequest;

    if (!accountAddress || !productId || typeof discountPercentage !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
    }

    try {
        const hashedAddress = HashUtil.hashTo(accountAddress);
        const couponKey = `${hashedAddress}:coupon:${productId}`;
        await kv.set(couponKey, discountPercentage);

        return res.status(200).json({ success: true, message: 'Coupon code added successfully.' });
    } catch (error) {
        console.error('Error adding coupon code:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}
