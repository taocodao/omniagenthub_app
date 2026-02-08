// pages/api/linkedin/post.ts
// Post content to LinkedIn via Composio

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { getComposioClient, getComposioUserId } from '../../../utils/composioConfig';
import { getLinkedInConnection } from '../../../utils/linkedinStorage';

interface PostRequestBody {
    content: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
}

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
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const auth0UserId = session.user.sub;
        const composioUserId = getComposioUserId(auth0UserId);

        // Parse request body
        const { content, visibility = 'PUBLIC' } = req.body as PostRequestBody;

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Content is required' });
        }

        if (content.length > 3000) {
            return res.status(400).json({ error: 'Content exceeds LinkedIn character limit (3000)' });
        }

        console.log('📝 [LINKEDIN-POST] Creating post for user:', composioUserId);
        console.log('📝 [LINKEDIN-POST] Content length:', content.length);

        // Get stored connection
        const connection = await getLinkedInConnection(auth0UserId);

        if (!connection || connection.status !== 'ACTIVE') {
            return res.status(400).json({
                error: 'LinkedIn account not connected',
                needsConnection: true,
            });
        }

        // Initialize Composio client
        const composio = getComposioClient();

        // Execute LinkedIn "Create a LinkedIn post" tool
        // Using Composio's tool execution with the connected account
        const result = await composio.tools.execute({
            action: 'LINKEDIN_CREATE_POST',
            connectedAccountId: connection.composioConnectedAccountId,
            input: {
                text: content,
                visibility: visibility,
            },
        });

        console.log('✅ [LINKEDIN-POST] Post created successfully:', result);

        // Extract post ID from result if available
        const postId = result?.data?.id || result?.data?.postId || null;

        return res.status(200).json({
            success: true,
            message: 'Posted to LinkedIn successfully',
            postId,
            data: result?.data,
        });

    } catch (error: any) {
        console.error('❌ [LINKEDIN-POST] Error:', error.message || error);

        // Check for specific error types
        if (error.message?.includes('token') || error.message?.includes('expired')) {
            return res.status(401).json({
                error: 'LinkedIn session expired. Please reconnect your account.',
                needsReconnection: true,
            });
        }

        return res.status(500).json({
            error: error.message || 'Failed to post to LinkedIn'
        });
    }
}
