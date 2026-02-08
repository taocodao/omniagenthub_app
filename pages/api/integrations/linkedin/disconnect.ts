// pages/api/integrations/linkedin/disconnect.ts
// Disconnect LinkedIn account

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { getComposioClient, getComposioUserId } from '../../../../utils/composioConfig';
import {
    getLinkedInConnection,
    deleteLinkedInConnection
} from '../../../../utils/linkedinStorage';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get authenticated user from Auth0 session
        const session = await getSession(req, res);

        if (!session?.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const auth0UserId = session.user.sub;
        const composioUserId = getComposioUserId(auth0UserId);

        console.log('🔌 [LINKEDIN-DISCONNECT] Disconnecting for user:', composioUserId);

        // Get stored connection
        const connection = await getLinkedInConnection(auth0UserId);

        if (!connection) {
            return res.status(200).json({
                success: true,
                message: 'No LinkedIn account was connected',
            });
        }

        // Try to revoke with Composio
        try {
            const composio = getComposioClient();

            if (connection.composioConnectedAccountId) {
                await composio.connectedAccounts.delete(connection.composioConnectedAccountId);
                console.log('✅ [LINKEDIN-DISCONNECT] Revoked Composio connection');
            }
        } catch (revokeError: any) {
            console.warn('⚠️ [LINKEDIN-DISCONNECT] Error revoking with Composio:', revokeError.message);
            // Continue to delete from storage even if Composio revoke fails
        }

        // Delete from storage
        await deleteLinkedInConnection(auth0UserId);

        return res.status(200).json({
            success: true,
            message: 'LinkedIn account disconnected successfully',
        });

    } catch (error: any) {
        console.error('❌ [LINKEDIN-DISCONNECT] Error:', error.message || error);
        return res.status(500).json({ error: error.message || 'Failed to disconnect' });
    }
}
