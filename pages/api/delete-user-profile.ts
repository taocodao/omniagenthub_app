import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

type ResponseData = {
    message: string;
    success: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({
            message: 'Method not allowed',
            success: false
        });
    }

    const { profileId, userAddress } = req.body;

    // Validate input
    if (!profileId || !userAddress) {
        return res.status(400).json({
            message: 'Missing required fields. Profile ID and user address are required.',
            success: false
        });
    }

    try {
        // Check if profile exists and belongs to the user
        const profileKey = `userProfile:${userAddress}:${profileId}`;
        const existingProfile = await kv.get(profileKey);

        if (!existingProfile) {
            return res.status(404).json({
                message: 'Profile not found or does not belong to this user.',
                success: false
            });
        }

        // Delete the profile
        await kv.del(profileKey);

        // Update user's profile list by removing the profileId
        let userProfiles = await kv.get(`userProfiles:${userAddress}`) as string[];
        if (userProfiles && Array.isArray(userProfiles)) {
            userProfiles = userProfiles.filter(id => id !== profileId);
            await kv.set(`userProfiles:${userAddress}`, userProfiles);
        }

        console.log(`Profile deleted successfully: ${profileId} for user: ${userAddress}`);

        return res.status(200).json({
            message: 'Profile deleted successfully',
            success: true
        });
    } catch (error) {
        console.error('Error deleting profile:', error);
        return res.status(500).json({
            message: 'Internal server error while deleting profile',
            success: false
        });
    }
}
