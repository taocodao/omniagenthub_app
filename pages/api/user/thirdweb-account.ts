import { NextApiRequest, NextApiResponse } from 'next';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { getThirdwebAccountFromAuth0Id } from '../../../utils/walletGenerator';

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getSession(req, res);

        if (!session || !session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const userId = session.user.sub;

        // Generate thirdweb account from Auth0 user ID
        // Note: Only pass userId, not thirdwebClient (ethers v5 doesn't need it)
        console.log('🔄 Creating thirdweb account for user:', userId);
        const account = getThirdwebAccountFromAuth0Id(userId);

        console.log('✅ Thirdweb account created:', account.address);

        return res.status(200).json({
            address: account.address,
            userId: userId,
            // Note: We don't send the full account object to client
            // Client will use server-side signing for transactions
        });
    } catch (error) {
        console.error('❌ Error creating thirdweb account:', error);
        return res.status(500).json({
            error: 'Failed to create account',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

export default withApiAuthRequired(handler);
