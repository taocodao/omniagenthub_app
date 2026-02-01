import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

type ResponseData = {
    exists: boolean;
    message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            exists: false,
            message: 'Method not allowed'
        });
    }

    const { userAddress, name } = req.query;

    if (!userAddress || !name || typeof userAddress !== 'string' || typeof name !== 'string') {
        return res.status(400).json({
            exists: false,
            message: 'User address and name are required.'
        });
    }

    try {
        // Get user's profile list
        const userProfiles = await kv.get(`userProfiles:${userAddress}`) as string[];

        if (!userProfiles || !Array.isArray(userProfiles)) {
            return res.status(200).json({
                exists: false,
                message: 'No profiles found.'
            });
        }

        // Check each profile for name collision
        for (const profileId of userProfiles) {
            try {
                const profileData = await kv.get(`userProfile:${userAddress}:${profileId}`) as any;
                if (profileData && profileData.name.toLowerCase() === name.toLowerCase()) {
                    return res.status(200).json({
                        exists: true,
                        message: 'Profile name already exists.'
                    });
                }
            } catch (error) {
                console.error(`Error checking profile ${profileId}:`, error);
                // Continue checking other profiles
            }
        }

        return res.status(200).json({
            exists: false,
            message: 'Profile name is available.'
        });

    } catch (error) {
        console.error('Error checking profile name:', error);
        return res.status(500).json({
            exists: false,
            message: 'Internal server error'
        });
    }
}
