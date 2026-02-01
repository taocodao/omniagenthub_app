// pages/api/useFreeUploads.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { UPLOAD_FILE_FEE } from '../../constants/constants';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

type Data = {
    message: string;
    remainingUploads?: number;
    success?: boolean;
    remainingPrice?: number;
    usedFreeUploads?: number;
    usedFreeChats?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    const { userKey, quantity } = req.body;

    // Ensure userKey is provided and quantity is positive
    if (!userKey || quantity === undefined || quantity <= 0) {
        return res.status(400).json({ message: "Missing or invalid required parameters. Quantity must be greater than 0." });
    }

    try {
        // Fetch current free uploads from KV store
        let currentFreeUploads = await kv.get(`${userKey}:freeUploads`) as number;
        currentFreeUploads = currentFreeUploads ? Number(currentFreeUploads) : 0;
        console.log("Current free uploads:", currentFreeUploads);

        if (currentFreeUploads >= quantity) {
            // Sufficient free uploads, update balance
            const newFreeUploads = currentFreeUploads - quantity;
            await kv.set(`${userKey}:freeUploads`, newFreeUploads);

            return res.status(200).json({
                remainingUploads: newFreeUploads,
                usedFreeUploads: quantity,
                message: "Free uploads successfully used.",
                success: true
            });
        } else {
            // Use what we have, then calculate remaining cost in free chats
            const uploadsUsed = currentFreeUploads;
            const remainingUploads = quantity - currentFreeUploads;

            // Set uploads to 0 since we'll use all available
            await kv.set(`${userKey}:freeUploads`, 0);

            // Convert remaining uploads to free chats cost (using UPLOAD_FILE_FEE)
            const chatsRequired = remainingUploads * UPLOAD_FILE_FEE;

            // Check if we have enough free chats
            let currentFreeChats = await kv.get(`${userKey}:freeTrades`) as number;
            currentFreeChats = currentFreeChats ? Number(currentFreeChats) : 0;

            if (currentFreeChats >= chatsRequired) {
                // We have enough free chats to cover remaining uploads
                const newFreeChats = currentFreeChats - chatsRequired;
                await kv.set(`${userKey}:freeTrades`, newFreeChats);

                return res.status(200).json({
                    remainingUploads: 0,
                    usedFreeUploads: uploadsUsed,
                    usedFreeChats: chatsRequired,
                    message: "Used all free uploads and deducted from free chats.",
                    success: true
                });
            } else {
                // Not enough free chats either, calculate remaining price
                const chatsUsed = currentFreeChats;
                const remainingChats = chatsRequired - currentFreeChats;

                // Set free chats to 0 since we'll use all available
                await kv.set(`${userKey}:freeTrades`, 0);

                // Each free chat is worth 0.01 USD
                const remainingPrice = remainingChats * 0.01;

                return res.status(200).json({
                    remainingUploads: 0,
                    usedFreeUploads: uploadsUsed,
                    usedFreeChats: chatsUsed,
                    message: "Insufficient free uploads and free chats.",
                    success: false,
                    remainingPrice
                });
            }
        }
    } catch (error) {
        console.error('Error in useFreeUploads:', error);
        return res.status(500).json({ message: 'Internal server error.', success: false });
    }
}
