// pages/api/user/wallet.ts
/**
 * API endpoint to get user's wallet address
 * MIGRATED: From Auth0 to Privy authentication
 * 
 * Returns: { address: string, userId: string }
 * 
 * How it works:
 * 1. Verifies Privy auth token from Authorization header
 * 2. Returns the user's embedded wallet address from Privy
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize Privy client for server-side auth
const privyClient = new PrivyClient(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            allowedMethods: ['GET']
        });
    }

    try {
        console.log('📍 /api/user/wallet - Request received (Privy)');

        // Get auth token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ No authorization header');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authorization header with Bearer token required'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify the Privy auth token
        const verifiedClaims = await privyClient.verifyAuthToken(token);
        const userId = verifiedClaims.userId;

        console.log('✅ User verified:', userId);

        // Get user details to find wallet address
        const user = await privyClient.getUser(userId);

        // Find the embedded wallet
        const embeddedWallet = user.linkedAccounts.find(
            (account) => account.type === 'wallet' && account.walletClientType === 'privy'
        ) as any;

        const address = embeddedWallet?.address || null;

        if (!address) {
            console.log('⚠️ No embedded wallet found for user');
            return res.status(200).json({
                address: null,
                userId,
                message: 'No embedded wallet found. User may need to log in again.',
                source: 'privy',
            });
        }

        console.log('✅ Wallet address:', address);

        return res.status(200).json({
            address,
            userId,
            source: 'privy',
        });

    } catch (error) {
        console.error('❌ Error in /api/user/wallet:', error);

        // Check for specific Privy errors
        if (error instanceof Error && error.message.includes('expired')) {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Please log in again'
            });
        }

        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get wallet address',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export default handler;
