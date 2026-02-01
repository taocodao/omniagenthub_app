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
    profiles?: ProfileData[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            message: 'Method not allowed',
            success: false
        });
    }

    const { userAddress } = req.query;

    if (!userAddress || typeof userAddress !== 'string') {
        return res.status(400).json({
            message: 'User address is required.',
            success: false
        });
    }

    try {
        // Get user's profile list
        const userProfiles = await kv.get(`userProfiles:${userAddress}`) as string[];

        if (!userProfiles || !Array.isArray(userProfiles) || userProfiles.length === 0) {
            return res.status(200).json({
                message: 'No profiles found for this user.',
                success: true,
                profiles: []
            });
        }

        // Fetch all profiles
        const profiles: ProfileData[] = [];

        for (const profileId of userProfiles) {
            try {
                const profileData = await kv.get(`userProfile:${userAddress}:${profileId}`) as any;

                if (profileData) {
                    // Return raw profile data with the four keywords
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

                    profiles.push(profile);
                }
            } catch (error) {
                console.error(`Error fetching profile ${profileId}:`, error);
                // Continue with other profiles
            }
        }

        console.log(`Retrieved ${profiles.length} profiles for user: ${userAddress}`);

        return res.status(200).json({
            message: 'Profiles retrieved successfully',
            success: true,
            profiles: profiles
        });

    } catch (error) {
        console.error('Error retrieving profiles:', error);
        return res.status(500).json({
            message: 'Internal server error while retrieving profiles',
            success: false
        });
    }
}
