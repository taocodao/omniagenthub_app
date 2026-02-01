// pages/api/useWebaiCredits.ts
/**
 * WEBAI Credit Payment API
 * 
 * Deducts WEBAI credits from payer and optionally transfers to recipient.
 * All balances stored in Vercel KV.
 * 
 * Request body:
 * - userKey: Payer's wallet address
 * - price: Amount in USD (1 credit = $0.01)
 * - recipientAddress: (optional) Recipient wallet for credit transfer
 */
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

    const { userKey, price, recipientAddress } = req.body;

    if (!userKey || typeof price !== 'number' || price <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid parameters: userKey and positive price required' });
    }

    try {
        const payerHashedKey = HashUtil.hashTo(userKey);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💳 useWebaiCredits API Called');
        console.log(`   Payer: ${userKey}`);
        console.log(`   Price: $${price}`);
        console.log(`   Recipient: ${recipientAddress || 'Platform (burn)'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Get payer's current balance
        const payerBalance = (await kv.get<number>(`${payerHashedKey}:webaiCredits`)) || 0;
        console.log(`📊 Payer balance: ${payerBalance} credits`);

        // Calculate credits needed (1 credit = $0.01)
        const creditsNeeded = price; // Keep as USD, not integer credits
        console.log(`💰 Credits needed: ${creditsNeeded}`);

        if (payerBalance < creditsNeeded) {
            console.log('⚠️ Insufficient WEBAI Credits');
            return res.status(400).json({
                success: false,
                message: 'Insufficient WEBAI Credits',
                balance: payerBalance,
                needed: creditsNeeded
            });
        }

        // Deduct from payer
        const newPayerBalance = Math.round((payerBalance - creditsNeeded) * 100) / 100;
        await kv.set(`${payerHashedKey}:webaiCredits`, newPayerBalance);
        console.log(`✅ Payer new balance: ${newPayerBalance}`);

        // If recipient provided, transfer credits
        if (recipientAddress) {
            const recipientHashedKey = HashUtil.hashTo(recipientAddress);
            const recipientBalance = (await kv.get<number>(`${recipientHashedKey}:webaiCredits`)) || 0;
            const newRecipientBalance = Math.round((recipientBalance + creditsNeeded) * 100) / 100;
            await kv.set(`${recipientHashedKey}:webaiCredits`, newRecipientBalance);
            console.log(`💸 Transferred ${creditsNeeded} to ${recipientAddress}`);
            console.log(`   Recipient new balance: ${newRecipientBalance}`);
        }

        // Log transaction for payer history
        const transaction = {
            timestamp: new Date().toISOString(),
            type: recipientAddress ? 'transfer' : 'spend',
            amount: -creditsNeeded,
            recipient: recipientAddress || 'platform',
            balanceAfter: newPayerBalance,
        };

        const txKey = `${payerHashedKey}:mcpTransactions`;
        const existingTx = (await kv.get<any[]>(txKey)) || [];
        existingTx.unshift(transaction);
        await kv.set(txKey, existingTx.slice(0, 100)); // Keep last 100

        return res.status(200).json({
            success: true,
            balance: newPayerBalance,
            transferred: recipientAddress ? creditsNeeded : 0
        });

    } catch (error: any) {
        console.error('❌ Error in useWebaiCredits:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
