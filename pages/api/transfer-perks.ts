// pages/api/transfer-perks.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the structure of the request body
interface TransferPerksRequest {
    fromAddress: string;
    toAddress: string;
    amount: number;
    perkType: 'freeTrades' | 'freeUploads' | 'freeWebScrape';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Allow only POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Extract data from the request body
    const { fromAddress, toAddress, amount, perkType } = req.body as TransferPerksRequest;

    // Validate required fields
    if (!fromAddress || !toAddress || typeof amount !== 'number' || !perkType) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Validate that amount is a positive number
    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number.' });
    }

    // Validate perkType
    const validPerkTypes = ['freeTrades', 'freeUploads', 'freeWebScrape'];
    if (!validPerkTypes.includes(perkType)) {
        return res.status(400).json({ message: 'Invalid perk type.' });
    }

    // Prevent transferring to the same address
    if (fromAddress.trim().toLowerCase() === toAddress.trim().toLowerCase()) {
        return res.status(400).json({ message: 'You cannot transfer to your own address.' });
    }

    // Hash the addresses to create consistent key formats for KV store
    const hashedFromAddress = HashUtil.hashTo(fromAddress);
    const hashedToAddress = HashUtil.hashTo(toAddress);

    try {
        // Define KV store keys based on perkType
        const fromPerkKey = `${hashedFromAddress}:${perkType}`;
        const toPerkKey = `${hashedToAddress}:${perkType}`;

        // Fetch current balances
        const [fromPerkValue, toPerkValue] = await Promise.all([
            kv.get<number>(fromPerkKey),
            kv.get<number>(toPerkKey),
        ]);

        const senderBalance = fromPerkValue ? Number(fromPerkValue) : 0;
        const receiverBalance = toPerkValue ? Number(toPerkValue) : 0;

        // Check if the sender has enough balance
        if (senderBalance < amount) {
            return res.status(400).json({
                message: `Insufficient balance to transfer. Your current balance: ${senderBalance}.`,
                remainingBalance: senderBalance,
            });
        }

        // Calculate new balances
        const newSenderBalance = senderBalance - amount;
        const newReceiverBalance = receiverBalance + amount;

        // **Atomicity Concerns:**
        // The following operations are not atomic. To ensure atomicity, consider using transactions or Lua scripts.
        // For simplicity, we'll proceed with separate operations.

        // Update the sender's balance
        const updateSender = kv.set(fromPerkKey, newSenderBalance);

        // Update the receiver's balance
        const updateReceiver = kv.set(toPerkKey, newReceiverBalance);

        // Execute both updates concurrently
        await Promise.all([updateSender, updateReceiver]);

        // Respond with success message and updated balances
        return res.status(200).json({
            message: 'Perk transferred successfully.',
            fromRemainingBalance: newSenderBalance,
            toNewBalance: newReceiverBalance,
        });
    } catch (error: any) {
        console.error('Error transferring perks:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}
