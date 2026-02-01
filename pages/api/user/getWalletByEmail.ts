// pages/api/user/getWalletByEmail.ts
/**
 * API endpoint to get user's wallet address by their email.
 * Uses Privy SDK to look up the user and return their embedded wallet.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrivyClient } from '@privy-io/server-auth';

const privyClient = new PrivyClient(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }

    try {
        console.log(`📧 Looking up Privy user by email: ${email}`);

        // Use Privy SDK to find user by email
        const user = await privyClient.getUserByEmail(email);

        if (!user) {
            console.log('❌ User not found for email:', email);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Find the embedded wallet
        // Find the embedded wallet
        const embeddedWallet = user.linkedAccounts.find(
            (account) => account.type === 'wallet' && account.walletClientType === 'privy'
        ) as any;

        if (!embeddedWallet?.address) {
            console.log('⚠️ No embedded wallet found for user:', email);
            return res.status(404).json({ success: false, error: 'No wallet found for user' });
        }

        console.log('✅ Found wallet for', email, ':', embeddedWallet.address);
        return res.status(200).json({
            success: true,
            address: embeddedWallet.address,
            userId: user.id
        });

    } catch (error: any) {
        console.error('❌ Error in getWalletByEmail:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
