// pages/api/useFreeWebScrape.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { UPLOAD_FILE_FEE } from '../../constants/constants';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

type Data = {
    message: string;
    remainingWebScrapes?: number;
    success?: boolean;
    remainingPrice?: number;
    usedFreeWebScrapes?: number;
    usedFreeChats?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    const { userKey, quantity } = req.body;

    // Ensure userKey is provided and quantity is positive
    if (!userKey || quantity === undefined || quantity <= 0) {
        return res.status(400).json({ message: "Missing or invalid required parameters. Quantity must be greater than 0." });
    }

    try {
        // Fetch current free web scrapes from KV store
        let currentFreeWebScrapes = await kv.get(`${userKey}:freeWebScrape`) as number;
        currentFreeWebScrapes = currentFreeWebScrapes ? Number(currentFreeWebScrapes) : 0;
        console.log("Current free web scrapes:", currentFreeWebScrapes);

        if (currentFreeWebScrapes >= quantity) {
            // Sufficient free web scrapes, update balance
            const newFreeWebScrapes = currentFreeWebScrapes - quantity;
            await kv.set(`${userKey}:freeWebScrape`, newFreeWebScrapes);

            return res.status(200).json({
                remainingWebScrapes: newFreeWebScrapes,
                usedFreeWebScrapes: quantity,
                message: "Free web scrapes successfully used.",
                success: true
            });
        } else {
            // Use what we have, then calculate remaining cost in free chats
            const webScrapesUsed = currentFreeWebScrapes;
            const remainingWebScrapes = quantity - currentFreeWebScrapes;

            // Set web scrapes to 0 since we'll use all available
            await kv.set(`${userKey}:freeWebScrape`, 0);

            // Convert remaining web scrapes to free chats cost (3 times UPLOAD_FILE_FEE)
            const chatsRequired = remainingWebScrapes * 3 * UPLOAD_FILE_FEE;

            // Check if we have enough free chats
            let currentFreeChats = await kv.get(`${userKey}:freeTrades`) as number;
            currentFreeChats = currentFreeChats ? Number(currentFreeChats) : 0;

            if (currentFreeChats >= chatsRequired) {
                // We have enough free chats to cover remaining web scrapes
                const newFreeChats = currentFreeChats - chatsRequired;
                await kv.set(`${userKey}:freeTrades`, newFreeChats);

                return res.status(200).json({
                    remainingWebScrapes: 0,
                    usedFreeWebScrapes: webScrapesUsed,
                    usedFreeChats: chatsRequired,
                    message: "Used all free web scrapes and deducted from free chats.",
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
                    remainingWebScrapes: 0,
                    usedFreeWebScrapes: webScrapesUsed,
                    usedFreeChats: chatsUsed,
                    message: "Insufficient free web scrapes and free chats.",
                    success: false,
                    remainingPrice
                });
            }
        }
    } catch (error) {
        console.error('Error in useFreeWebScrape:', error);
        return res.status(500).json({ message: 'Internal server error.', success: false });
    }
}
