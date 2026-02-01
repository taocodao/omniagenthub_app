import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface TransferRequest {
    fromAddress: string;
    toAddress: string;
    amount: number;
}

interface TransferResponse {
    success: boolean;
    message?: string;
    error?: string;
    fromBalance?: number;
    toBalance?: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TransferResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { fromAddress, toAddress, amount } = req.body as TransferRequest;

    // Validate inputs
    if (!fromAddress || !toAddress) {
        return res.status(400).json({ success: false, error: 'Missing fromAddress or toAddress' });
    }

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
    }

    if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
        return res.status(400).json({ success: false, error: 'Cannot transfer to yourself' });
    }

    try {
        // Use same hash function as useWebaiCredits.ts
        const fromHashedKey = HashUtil.hashTo(fromAddress);
        const toHashedKey = HashUtil.hashTo(toAddress);

        // Use same key format as useWebaiCredits.ts: ${hash}:webaiCredits
        const fromBalance = (await kv.get<number>(`${fromHashedKey}:webaiCredits`)) || 0;

        console.log(`[transferCredits] From: ${fromAddress} (${fromHashedKey})`);
        console.log(`[transferCredits] Current balance: $${fromBalance}`);
        console.log(`[transferCredits] Transfer amount: $${amount}`);

        if (fromBalance < amount) {
            return res.status(400).json({
                success: false,
                error: `Insufficient credits. You have $${fromBalance.toFixed(2)} available.`
            });
        }

        // Get recipient's current balance
        const toBalance = (await kv.get<number>(`${toHashedKey}:webaiCredits`)) || 0;

        // Perform the transfer with rounding to avoid floating point issues
        const newFromBalance = Math.round((fromBalance - amount) * 100) / 100;
        const newToBalance = Math.round((toBalance + amount) * 100) / 100;

        // Update both balances using same key format as useWebaiCredits.ts
        await kv.set(`${fromHashedKey}:webaiCredits`, newFromBalance);
        await kv.set(`${toHashedKey}:webaiCredits`, newToBalance);

        // Log the transaction for audit
        const transactionLog = {
            type: 'transfer',
            from: fromAddress,
            to: toAddress,
            amount: amount,
            timestamp: new Date().toISOString(),
            fromBalanceAfter: newFromBalance,
            toBalanceAfter: newToBalance,
        };

        // Store transaction logs using hashed keys
        await kv.lpush(`${fromHashedKey}:transactions`, JSON.stringify(transactionLog));
        await kv.lpush(`${toHashedKey}:transactions`, JSON.stringify(transactionLog));

        console.log(`[transferCredits] ✅ Transferred $${amount} from ${fromAddress} to ${toAddress}`);
        console.log(`[transferCredits] New balances: $${newFromBalance} -> $${newToBalance}`);

        return res.status(200).json({
            success: true,
            message: `Successfully transferred $${amount.toFixed(2)} credits`,
            fromBalance: newFromBalance,
            toBalance: newToBalance,
        });
    } catch (error) {
        console.error('[transferCredits] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while transferring credits'
        });
    }
}
