// pages/api/mcp/pay.ts
// API endpoint to pay for MCP server usage with WEBAI Credits

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

interface MCPPaymentRequest {
    userAddress: string;
    mcpServerUrl: string;
    price: number;  // Price in USD (e.g., 0.01 per credit)
}

interface MCPPaymentResponse {
    success: boolean;
    message: string;
    remainingCredits?: number;
    paymentMethod?: 'webai_credits' | 'usdc' | 'none';
    authToken?: string;  // Token to authorize the MCP request
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<MCPPaymentResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    const { userAddress, mcpServerUrl, price } = req.body as MCPPaymentRequest;

    // Validate input
    if (!userAddress || !mcpServerUrl || typeof price !== 'number' || price < 0) {
        return res.status(400).json({
            success: false,
            message: 'Missing or invalid parameters. Required: userAddress, mcpServerUrl, price'
        });
    }

    try {
        // Hash the address for KV lookup
        const hashedKey = HashUtil.hashTo(userAddress);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💳 MCP Payment API Called');
        console.log('📦 Request:', { userAddress, mcpServerUrl, price });
        console.log('🔑 Hashed key:', hashedKey);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Get current WEBAI Credits balance
        const currentBalance = await kv.get(`${hashedKey}:webaiCredits`) as number || 0;

        console.log(`📊 Current WEBAI Credits balance: ${currentBalance}`);
        console.log(`💰 Price: $${price}`);

        // Calculate credits needed (1 credit = $0.01)
        const creditsNeeded = Math.ceil(price / 0.01);
        console.log(`🧮 Credits needed: ${creditsNeeded}`);

        if (currentBalance >= creditsNeeded) {
            // Sufficient WEBAI Credits - deduct and authorize
            const newBalance = currentBalance - creditsNeeded;
            await kv.set(`${hashedKey}:webaiCredits`, newBalance);

            // Generate a simple auth token for this request
            const authToken = Buffer.from(`${userAddress}:${Date.now()}:${mcpServerUrl}`).toString('base64');

            console.log(`✅ Payment successful via WEBAI Credits`);
            console.log(`📊 New balance: ${newBalance}`);

            // Log the transaction
            const transactionKey = `${hashedKey}:mcpTransactions`;
            const transaction = {
                timestamp: new Date().toISOString(),
                mcpServerUrl,
                creditsUsed: creditsNeeded,
                priceUsd: price,
                balanceAfter: newBalance
            };

            // Append to transactions list (keep last 100)
            const existingTransactions = await kv.get(transactionKey) as any[] || [];
            existingTransactions.unshift(transaction);
            await kv.set(transactionKey, existingTransactions.slice(0, 100));

            return res.status(200).json({
                success: true,
                message: 'Payment successful via WEBAI Credits',
                remainingCredits: newBalance,
                paymentMethod: 'webai_credits',
                authToken
            });
        } else {
            // Insufficient WEBAI Credits
            console.log(`⚠️ Insufficient WEBAI Credits. Have: ${currentBalance}, Need: ${creditsNeeded}`);

            return res.status(402).json({
                success: false,
                message: `Insufficient WEBAI Credits. You have ${currentBalance} credits but need ${creditsNeeded} credits ($${price}).`,
                remainingCredits: currentBalance,
                paymentMethod: 'none'
            });
        }
    } catch (error: any) {
        console.error('❌ Error in MCP payment:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}
