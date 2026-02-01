// pages/api/mcp/balance.ts
// API endpoint to get WEBAI Credits balance for a user

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

interface BalanceResponse {
    success: boolean;
    balance?: number;
    balanceUsd?: number;
    message?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<BalanceResponse>
) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    // Support both GET (query params) and POST (body)
    const userAddress = req.method === 'GET'
        ? req.query.userAddress as string
        : req.body.userAddress;

    if (!userAddress) {
        return res.status(400).json({
            success: false,
            message: 'Missing userAddress parameter'
        });
    }

    try {
        const hashedKey = HashUtil.hashTo(userAddress);
        const balance = await kv.get(`${hashedKey}:webaiCredits`) as number || 0;

        return res.status(200).json({
            success: true,
            balance: balance,
            balanceUsd: balance * 0.01  // 1 credit = $0.01
        });
    } catch (error: any) {
        console.error('Error fetching balance:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}
