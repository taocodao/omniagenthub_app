import { NextApiRequest, NextApiResponse } from 'next';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { getThirdwebSDKWallet } from '../../../../utils/walletGenerator';
import { ethers } from 'ethers';

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getSession(req, res);

        if (!session || !session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { to, value, data } = req.body;

        // Get user's wallet
        const wallet = getThirdwebSDKWallet(session.user.sub);

        console.log('🔄 Signing transaction for:', wallet.address);

        // Ethers v5: providers.JsonRpcProvider
        const provider = new ethers.providers.JsonRpcProvider(
            process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
        );
        const connectedWallet = wallet.connect(provider);

        // Prepare transaction (ethers v5)
        const tx = {
            to: to,
            value: ethers.utils.parseEther(value || '0'),
            data: data || '0x',
        };

        // Send transaction
        const txResponse = await connectedWallet.sendTransaction(tx);
        console.log('✅ Transaction sent:', txResponse.hash);

        // Wait for confirmation
        const receipt = await txResponse.wait();
        console.log('✅ Transaction confirmed:', receipt.transactionHash);

        return res.status(200).json({
            success: true,
            transactionHash: receipt.transactionHash,
        });
    } catch (error) {
        console.error('❌ Transaction error:', error);
        return res.status(500).json({
            error: 'Transaction failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

export default withApiAuthRequired(handler);
