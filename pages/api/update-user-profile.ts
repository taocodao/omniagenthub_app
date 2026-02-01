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
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    if (req.method !== 'PUT') {
        return res.status(405).json({
            message: 'Method not allowed',
            success: false
        });
    }

    const { profileId, name, business, USP, persona, challenges, websiteUrl, userAddress } = req.body;

    // Validate input
    if (!profileId || !name || !business || !USP || !persona || !challenges || !userAddress) {
        return res.status(400).json({
            message: 'Missing required fields. All profile fields, profile ID, and user address are required.',
            success: false
        });
    }

    try {
        // Verify profile exists and belongs to user
        const profileKey = `userProfile:${userAddress}:${profileId}`;
        const existingProfile = await kv.get(profileKey) as any;

        if (!existingProfile) {
            return res.status(404).json({
                message: 'Profile not found or does not belong to this user.',
                success: false
            });
        }

        // Update profile data (keep original createdAt)
        const updatedProfileData: ProfileData = {
            name: name.trim(),
            business: business.trim(),
            USP: USP.trim(),
            persona: persona.trim(),
            challenges: challenges.trim(),
            websiteUrl: websiteUrl?.trim() || '',
            userAddress: userAddress,
            createdAt: existingProfile.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        console.log('Updating profile data:', {
            profileId,
            name: updatedProfileData.name,
            businessLength: updatedProfileData.business.length,
            USPLength: updatedProfileData.USP.length,
            personaLength: updatedProfileData.persona.length,
            challengesLength: updatedProfileData.challenges.length
        });

        // Save updated profile data
        await kv.set(profileKey, updatedProfileData);

        console.log(`Profile updated successfully: ${profileId} for user: ${userAddress}`);

        return res.status(200).json({
            message: 'Profile updated successfully',
            success: true
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({
            message: 'Internal server error while updating profile',
            success: false
        });
    }
}
