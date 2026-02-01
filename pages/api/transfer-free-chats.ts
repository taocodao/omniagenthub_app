// pages/api/transfer-free-chats.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the structure of the request body
interface TransferFreeChatsRequest {
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
    const { fromAddress, toAddress, amount } = req.body as TransferFreeChatsRequest;

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
        // Retrieve current freeChats for both users
        let fromFreeChats = await kv.get<number>(`${hashedFromAddress}:freeTrades`);
        let toFreeChats = await kv.get<number>(`${hashedToAddress}:freeTrades`);

        // **New Validation: Check if the destination address is valid**
        if (toFreeChats === null) {
            return res.status(400).json({ message: 'Destination address is invalid.' });
        }

        fromFreeChats = fromFreeChats ? Number(fromFreeChats) : 0;
        toFreeChats = Number(toFreeChats);

        // Check if the sender has enough free chats
        if (fromFreeChats < amount) {
            return res.status(400).json({
                message: 'Insufficient free chats to transfer.',
                remainingChats: fromFreeChats,
            });
        }

        // Update the freeChats balance for both users
        const newFromFreeChats = fromFreeChats - amount;
        const newToFreeChats = toFreeChats + amount;

        await kv.set(`${hashedFromAddress}:freeTrades`, newFromFreeChats);
        await kv.set(`${hashedToAddress}:freeTrades`, newToFreeChats);

        // Respond with success message and updated balances
        return res.status(200).json({
            message: 'Free chats transferred successfully.',
            fromRemainingChats: newFromFreeChats,
            toRemainingChats: newToFreeChats,
        });
    } catch (error) {
        console.error('Error transferring free chats:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}
