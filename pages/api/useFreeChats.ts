// pages/api/useFreeChats.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userKey, price } = req.body;  // userKey is now raw address

    if (!userKey || typeof price !== 'number') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        // Hash the address here in the backend
        const hashedKey = HashUtil.hashTo(userKey);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💳 useFreeChats API Called');
        console.log('📦 Request body: {');
        console.log(`  "userKey": "${userKey}",`);
        console.log(`  "price": ${price}`);
        console.log('}');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`📊 Hashed key: ${hashedKey}`);

        // Get current balance
        const currentBalance = await kv.get(`${hashedKey}:freeTrades`) as number;

        console.log(`📊 Current balance: ${currentBalance}`);
        console.log(`💰 Price received: ${price}`);

        const chatsToDeduct = Math.floor(price / 0.01);
        console.log(`🧮 Calculated chats to deduct: ${chatsToDeduct}`);
        console.log(`   (Formula: Math.floor(${price} / 0.01) = ${chatsToDeduct})`);

        const newBalance = currentBalance - chatsToDeduct;
        console.log(`🎯 New balance will be: ${newBalance}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (currentBalance <= 0 || newBalance < 0) {
            console.log('⚠️ No free chats available');
            return res.status(400).json({
                success: false,
                message: 'Insufficient free chats',
                balance: currentBalance
            });
        }

        // Update balance
        await kv.set(`${hashedKey}:freeTrades`, newBalance);
        console.log(`✅ Balance updated successfully to: ${newBalance}`);

        return res.status(200).json({
            success: true,
            balance: newBalance
        });

    } catch (error: any) {
        console.error('❌ Error in useFreeChats:', error);
        return res.status(500).json({ error: error.message });
    }
}
