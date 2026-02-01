// pages/api/transfer-webai-credits.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

// Define the structure of the request body
interface TransferWebaiCreditsRequest {
    fromAddress: string;
    toAddress: string;
    amount: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Allow only POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Extract data from the request body
    const { fromAddress, toAddress, amount } = req.body as TransferWebaiCreditsRequest;

    // Validate required fields
    if (!fromAddress || !toAddress || typeof amount !== 'number') {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Validate that amount is a positive number
    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number.' });
    }

    // Hash the addresses to create consistent key formats for KV store
    const hashedFromAddress = HashUtil.hashTo(fromAddress);
    const hashedToAddress = HashUtil.hashTo(toAddress);

    try {
        // Retrieve current WEBAI Credits for both users
        let fromCredits = await kv.get<number>(`${hashedFromAddress}:webaiCredits`);
        let toCredits = await kv.get<number>(`${hashedToAddress}:webaiCredits`);

        // **New Validation: Check if the destination address is valid**
        if (toCredits === null) {
            return res.status(400).json({ message: 'Destination address is invalid.' });
        }

        fromCredits = fromCredits ? Number(fromCredits) : 0;
        toCredits = Number(toCredits);

        // Check if the sender has enough WEBAI Credits
        if (fromCredits < amount) {
            return res.status(400).json({
                message: 'Insufficient WEBAI Credits to transfer.',
                remainingCredits: fromCredits,
            });
        }

        // Update the WEBAI Credits balance for both users
        const newFromCredits = fromCredits - amount;
        const newToCredits = toCredits + amount;

        await kv.set(`${hashedFromAddress}:webaiCredits`, newFromCredits);
        await kv.set(`${hashedToAddress}:webaiCredits`, newToCredits);

        // Respond with success message and updated balances
        return res.status(200).json({
            message: 'WEBAI Credits transferred successfully.',
            fromRemainingCredits: newFromCredits,
            toRemainingCredits: newToCredits,
        });
    } catch (error) {
        console.error('Error transferring WEBAI Credits:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}
