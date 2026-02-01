import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface ProfileData {
    name: string;
    business: string;
    USP: string;
    persona: string;
    challenges: string;
    websiteUrl?: string;
    userAddress: string;
    createdAt: string;
    updatedAt: string;
}

type ResponseData = {
    message: string;
    success: boolean;
    profileId?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            message: 'Method not allowed',
            success: false
        });
    }

    const { name, business, USP, persona, challenges, websiteUrl, userAddress } = req.body;

    // Validate input
    if (!name || !business || !USP || !persona || !challenges || !userAddress) {
        return res.status(400).json({
            message: 'Missing required fields. All profile fields and user address are required.',
            success: false
        });
    }

    try {
        // Generate unique profile ID
        const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        // Create profile data with the four keywords only
        const profileData: ProfileData = {
            name: name.trim(),
            business: business.trim(),
            USP: USP.trim(),
            persona: persona.trim(),
            challenges: challenges.trim(),
            websiteUrl: websiteUrl?.trim() || '',
            userAddress: userAddress,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        console.log('Saving profile data:', {
            name: profileData.name,
            businessLength: profileData.business.length,
            USPLength: profileData.USP.length,
            personaLength: profileData.persona.length,
            challengesLength: profileData.challenges.length
        });

        // Save profile data
        await kv.set(`userProfile:${userAddress}:${profileId}`, profileData);

        // Update user's profile list
        let userProfiles = await kv.get(`userProfiles:${userAddress}`) as string[];
        userProfiles = userProfiles || [];
        userProfiles.push(profileId);
        await kv.set(`userProfiles:${userAddress}`, userProfiles);

        console.log(`Profile saved successfully: ${profileId} for user: ${userAddress}`);

        return res.status(200).json({
            message: 'Profile saved successfully',
            success: true,
            profileId: profileId
        });
    } catch (error) {
        console.error('Error saving profile:', error);
        return res.status(500).json({
            message: 'Internal server error while saving profile',
            success: false
        });
    }
}
