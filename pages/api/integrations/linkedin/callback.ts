// pages/api/integrations/linkedin/callback.ts
// Handle OAuth callback from Composio

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { getComposioClient, getComposioUserId } from '../../../../utils/composioConfig';
import { saveLinkedInConnection, getLinkedInConnection } from '../../../../utils/linkedinStorage';

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
            console.error('❌ [LINKEDIN-CALLBACK] No authenticated user');
            return res.redirect('/signin?error=not_authenticated');
        }

        const auth0UserId = session.user.sub;
        const composioUserId = getComposioUserId(auth0UserId);

        console.log('🔄 [LINKEDIN-CALLBACK] Processing callback for user:', composioUserId);

        // Get current pending connection
        const pendingConnection = await getLinkedInConnection(auth0UserId);

        if (!pendingConnection) {
            console.error('❌ [LINKEDIN-CALLBACK] No pending connection found');
            return res.redirect('/auth/linkedin-error?error=no_pending_connection');
        }

        // Initialize Composio client
        const composio = getComposioClient();

        // Check connection status with Composio
        // Poll for ACTIVE status (Composio handles the OAuth completion)
        let connectionStatus = 'PENDING';
        let connectedAccountId = pendingConnection.composioConnectedAccountId;

        try {
            // Get connected accounts for this user
            const accounts = await composio.connectedAccounts.list({
                user_ids: [composioUserId],
                statuses: ['ACTIVE'],
            });

            // Find the LinkedIn account
            const linkedInAccount = accounts.items?.find(
                (account: any) => account.integrationId === 'linkedin'
            );

            if (linkedInAccount) {
                connectionStatus = 'ACTIVE';
                connectedAccountId = linkedInAccount.id;
                console.log('✅ [LINKEDIN-CALLBACK] Found active connection:', connectedAccountId);
            } else {
                // Connection might still be processing
                console.log('⏳ [LINKEDIN-CALLBACK] Connection still pending');
            }
        } catch (pollError: any) {
            console.warn('⚠️ [LINKEDIN-CALLBACK] Error checking connection status:', pollError.message);
        }

        // Update connection in storage
        await saveLinkedInConnection(auth0UserId, {
            composioConnectedAccountId: connectedAccountId,
            status: connectionStatus as any,
            connectedAt: pendingConnection.connectedAt,
            lastCheckedAt: new Date().toISOString(),
        });

        // Redirect to success page
        if (connectionStatus === 'ACTIVE') {
            console.log('✅ [LINKEDIN-CALLBACK] Connection successful, redirecting to success page');
            return res.redirect('/auth/linkedin-success');
        } else {
            // Connection is still pending - redirect with status
            return res.redirect('/auth/linkedin-success?status=pending');
        }

    } catch (error: any) {
        console.error('❌ [LINKEDIN-CALLBACK] Error:', error.message || error);
        return res.redirect('/auth/linkedin-error?error=' + encodeURIComponent(error.message || 'callback_failed'));
    }
}
