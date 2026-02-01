// pages/api/admin/manageProfiles.ts
// List: http://localhost:3000/api/admin/manageProfiles?userAddress=YOUR_ADDRESS
// Delete: http://localhost:3000/api/admin/manageProfiles?userAddress=YOUR_ADDRESS&deleteName=Productivity%20Improvement

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface ProfileData {
    profileId: string;
    profileName: string;
    profileDescription?: string;
    sources?: unknown[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { userAddress, deleteName, deleteId } = req.query;

    const addr = userAddress as string || '0xc58aCc046d60FE877aC6fA3070665743Da52A89C';

    try {
        // Get user's profile list
        const userProfiles = await kv.get(`userProfiles:${addr}`) as string[] || [];

        console.log(`[manageProfiles] User: ${addr}`);
        console.log(`[manageProfiles] Profile IDs: ${userProfiles}`);

        // Load all profile data
        const profilesWithData: ProfileData[] = [];
        for (const profileId of userProfiles) {
            const profileData = await kv.get(`profile:${profileId}`) as Record<string, unknown> | null;
            if (profileData) {
                profilesWithData.push({
                    profileId,
                    profileName: profileData.profileName as string || 'Unknown',
                    profileDescription: profileData.profileDescription as string,
                    sources: profileData.sources as unknown[],
                });
            }
        }

        // Delete by name
        if (deleteName && typeof deleteName === 'string') {
            const profilesToDelete = profilesWithData.filter(p =>
                p.profileName.toLowerCase().includes(deleteName.toLowerCase())
            );

            if (profilesToDelete.length === 0) {
                return res.status(404).json({
                    error: `No profile found with name containing: ${deleteName}`,
                    availableProfiles: profilesWithData.map(p => p.profileName)
                });
            }

            // Remove from profile list
            const updatedProfileIds = userProfiles.filter(
                id => !profilesToDelete.some(p => p.profileId === id)
            );
            await kv.set(`userProfiles:${addr}`, updatedProfileIds);

            // Delete profile data
            for (const profile of profilesToDelete) {
                await kv.del(`profile:${profile.profileId}`);
            }

            return res.status(200).json({
                message: `Deleted ${profilesToDelete.length} profile(s)`,
                deleted: profilesToDelete.map(p => p.profileName),
                remainingProfiles: profilesWithData
                    .filter(p => !profilesToDelete.some(d => d.profileId === p.profileId))
                    .map(p => p.profileName)
            });
        }

        // Delete by ID
        if (deleteId && typeof deleteId === 'string') {
            const updatedProfileIds = userProfiles.filter(id => id !== deleteId);
            await kv.set(`userProfiles:${addr}`, updatedProfileIds);
            await kv.del(`profile:${deleteId}`);

            return res.status(200).json({
                message: `Deleted profile: ${deleteId}`,
                remainingCount: updatedProfileIds.length
            });
        }

        // List all profiles
        return res.status(200).json({
            userAddress: addr,
            profileCount: profilesWithData.length,
            profiles: profilesWithData
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: String(error) });
    }
}
