// pages/api/integrations/linkedin/connect.ts
// Start LinkedIn OAuth connection via Composio Connect Link

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { getComposioClient, LINKEDIN_AUTH_CONFIG_ID, getComposioUserId } from '../../../../utils/composioConfig';
import { saveLinkedInConnection } from '../../../../utils/linkedinStorage';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get authenticated user from Auth0 session
        const session = await getSession(req, res);

        if (!session?.user) {
            console.error('❌ [LINKEDIN-CONNECT] No authenticated user');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const auth0UserId = session.user.sub;
        const composioUserId = getComposioUserId(auth0UserId);

        console.log('🔗 [LINKEDIN-CONNECT] Starting connection for user:', composioUserId);

        // Validate Auth Config ID is set
        if (!LINKEDIN_AUTH_CONFIG_ID) {
            console.error('❌ [LINKEDIN-CONNECT] COMPOSIO_LINKEDIN_AUTH_CONFIG_ID not configured');
            return res.status(500).json({
                error: 'LinkedIn integration not configured. Please set COMPOSIO_LINKEDIN_AUTH_CONFIG_ID.'
            });
        }

        // Build callback URL
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        const host = req.headers.host || 'localhost:3000';
        const callbackUrl = `${protocol}://${host}/api/integrations/linkedin/callback`;

        // Initialize Composio client and create connection request
        const composio = getComposioClient();

        // Create connection request via Composio SDK
        // The SDK uses create() method with auth_config and connection params
        const connectionRequest = await composio.connectedAccounts.create({
            auth_config: {
                id: LINKEDIN_AUTH_CONFIG_ID
            },
            connection: {
                user_id: composioUserId,
                callback_url: callbackUrl,
            }
        });

        // Extract redirect URL from the response
        let redirectUrl = '';
        const connectionData = connectionRequest.connectionData;
        if (connectionData && 'val' in connectionData && typeof connectionData.val === 'object' &&
            connectionData.val !== null && 'redirectUrl' in connectionData.val) {
            redirectUrl = connectionData.val.redirectUrl as string;
        } else if ('redirect_url' in connectionRequest) {
            redirectUrl = (connectionRequest as any).redirect_url;
        }

        console.log('✅ [LINKEDIN-CONNECT] Connection request created:', {
            connectionId: connectionRequest.id,
            redirectUrl: redirectUrl,
        });

        // Save pending connection state
        await saveLinkedInConnection(auth0UserId, {
            composioConnectedAccountId: connectionRequest.id,
            status: 'PENDING',
            connectedAt: new Date().toISOString(),
        });

        // Return redirect URL for frontend
        return res.status(200).json({
            success: true,
            redirectUrl: redirectUrl,
        });

    } catch (error: any) {
        console.error('❌ [LINKEDIN-CONNECT] Error:', error.message || error);
        return res.status(500).json({
            error: error.message || 'Failed to initiate LinkedIn connection'
        });
    }
}
