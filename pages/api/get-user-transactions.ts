
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { userAddress } = req.body;

    if (!userAddress) {
        return res.status(400).json({ message: 'User address is required' });
    }

    try {
        const userKey = HashUtil.hashTo(userAddress);
        const transactionsKey = `${userKey}:mcpTransactions`; // Key used by backend

        // Fetch transactions from KV
        const transactions = await kv.get<any[]>(transactionsKey) || [];

        // Sort by timestamp descending if not already sorted
        transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return res.status(200).json({
            success: true,
            transactions: transactions.slice(0, 50) // Limit to 50 most recent
        });
    } catch (error) {
        console.error('Error fetching user transactions:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
