// pages/api/integrations/linkedin/status.ts
// Check LinkedIn connection status

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { getComposioClient, getComposioUserId } from '../../../../utils/composioConfig';
import {
    getLinkedInConnection,
    updateLinkedInConnectionStatus
} from '../../../../utils/linkedinStorage';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
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

        // Get stored connection
        const connection = await getLinkedInConnection(auth0UserId);

        if (!connection) {
            return res.status(200).json({
                connected: false,
                status: null,
                message: 'No LinkedIn account connected',
            });
        }

        // If stored as ACTIVE, optionally verify with Composio
        const { refresh } = req.query;

        if (refresh === 'true' && connection.status === 'ACTIVE') {
            try {
                const composio = getComposioClient();

                // Verify the connection is still active
                const accounts = await composio.connectedAccounts.list({
                    userUuid: composioUserId,
                    status: 'ACTIVE',
                });

                const linkedInAccount = accounts.items?.find(
                    (account: any) => account.integrationId === 'linkedin'
                );

                if (!linkedInAccount) {
                    // Connection no longer active
                    await updateLinkedInConnectionStatus(auth0UserId, 'EXPIRED');

                    return res.status(200).json({
                        connected: false,
                        status: 'EXPIRED',
                        message: 'LinkedIn connection has expired. Please reconnect.',
                    });
                }
            } catch (verifyError: any) {
                console.warn('⚠️ [LINKEDIN-STATUS] Error verifying connection:', verifyError.message);
            }
        }

        return res.status(200).json({
            connected: connection.status === 'ACTIVE',
            status: connection.status,
            connectedAt: connection.connectedAt,
            lastCheckedAt: connection.lastCheckedAt,
        });

    } catch (error: any) {
        console.error('❌ [LINKEDIN-STATUS] Error:', error.message || error);
        return res.status(500).json({ error: error.message || 'Failed to check status' });
    }
}
