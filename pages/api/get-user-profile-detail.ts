import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface ProfileData {
    id: string;
    name: string;
    business: string;
    USP: string;
    persona: string;
    challenges: string;
    websiteUrl?: string;
    createdAt: string;
    updatedAt: string;
}

type ResponseData = {
    message: string;
    success: boolean;
    profile?: ProfileData;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            message: 'Method not allowed',
            success: false
        });
    }

    const { profileId, userAddress } = req.query;

    if (!profileId || !userAddress || typeof profileId !== 'string' || typeof userAddress !== 'string') {
        return res.status(400).json({
            message: 'Profile ID and user address are required.',
            success: false
        });
    }

    try {
        // Fetch the specific profile
        const profileKey = `userProfile:${userAddress}:${profileId}`;
        const profileData = await kv.get(profileKey) as any;

        if (!profileData) {
            return res.status(404).json({
                message: 'Profile not found or does not belong to this user.',
                success: false
            });
        }

        // Return the raw profile data with the four keywords
        const profile: ProfileData = {
            id: profileId,
            name: profileData.name,
            business: profileData.business,
            USP: profileData.USP,
            persona: profileData.persona,
            challenges: profileData.challenges,
            websiteUrl: profileData.websiteUrl || '',
            createdAt: profileData.createdAt || new Date().toISOString(),
            updatedAt: profileData.updatedAt || new Date().toISOString()
        };

        console.log(`Retrieved profile ${profileId} for user: ${userAddress}`);

        return res.status(200).json({
            message: 'Profile retrieved successfully',
            success: true,
            profile: profile
        });

    } catch (error) {
        console.error('Error retrieving profile detail:', error);
        return res.status(500).json({
            message: 'Internal server error while retrieving profile',
            success: false
        });
    }
}
