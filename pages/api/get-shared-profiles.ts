import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface UserProfile {
    id: string;
    name: string;
    business: string;
    USP: string;
    persona: string;
    challenges: string;
    websiteUrl: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    isOwned: boolean;
    ownerAddress: string;
    userAddress?: string;
}

interface SharedProfileResponse {
    success: boolean;
    profiles: UserProfile[];
    error?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SharedProfileResponse>
) {
    // Validate HTTP method
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            profiles: [],
            error: "Method not allowed"
        });
    }

    // Validate required parameters
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== "string") {
        return res.status(400).json({
            success: false,
            profiles: [],
            error: "Missing or invalid userAddress parameter"
        });
    }

    try {
        const sharedProfiles: UserProfile[] = [];
        let cursor: string | number = "0";
        const pattern = "sharedProfiles:*";
        let totalScanned = 0;
        let profilesWithAccess = 0;

        console.log(`🔍 [${new Date().toISOString()}] Starting shared profile scan for user: ${userAddress}`);

        // Scan through all shared profile keys
        do {
            const scanResult = await kv.scan(cursor, {
                match: pattern,
                count: 100
            });
            cursor = scanResult[0];
            const keys = scanResult[1];
            totalScanned += keys.length;

            console.log(`📊 Batch processed: ${keys.length} keys (Total scanned: ${totalScanned})`);

            // Process each shared profile key
            for (const key of keys) {
                try {
                    const profileId = key.replace("sharedProfiles:", "");
                    const sharedUsers = await kv.get(key) as string[];

                    console.log(`🔎 Profile ${profileId} shared with ${sharedUsers?.length || 0} users`);

                    // Check if current user has access to this profile
                    if (sharedUsers && Array.isArray(sharedUsers) && sharedUsers.includes(userAddress)) {
                        profilesWithAccess++;
                        console.log(`✅ User ${userAddress} has access to profile ${profileId}`);

                        // Fetch the actual profile data
                        const profileData = await fetchSharedProfileData(profileId);

                        if (profileData) {
                            const formattedProfile = formatSharedProfile(profileData, profileId);
                            sharedProfiles.push(formattedProfile);
                            console.log(`✅ Successfully added shared profile: ${formattedProfile.name}`);
                        } else {
                            console.warn(`⚠️ Profile data not found for ${profileId}, attempting fallback recovery`);
                            await debugProfileKeys(profileId);
                        }
                    } else {
                        console.log(`❌ User ${userAddress} does not have access to profile ${profileId}`);
                    }
                } catch (keyError) {
                    console.error(`❌ Error processing key ${key}:`, keyError);
                    // Continue processing other keys instead of failing completely
                    continue;
                }
            }
        } while (cursor !== "0");

        // Log final statistics
        console.log(`📊 Scan complete for ${userAddress}:`);
        console.log(`   - Total profiles scanned: ${totalScanned}`);
        console.log(`   - Profiles with user access: ${profilesWithAccess}`);
        console.log(`   - Successfully retrieved: ${sharedProfiles.length}`);

        if (sharedProfiles.length > 0) {
            console.log('📋 Retrieved shared profiles:', sharedProfiles.map(p => ({
                id: p.id,
                name: p.name,
                owner: p.ownerAddress,
                business: p.business
            })));
        }

        // Return successful response
        return res.status(200).json({
            success: true,
            profiles: sharedProfiles
        });

    } catch (error) {
        console.error(`❌ Critical error in get-shared-profiles for user ${userAddress}:`, error);

        return res.status(500).json({
            success: false,
            profiles: [],
            error: "Internal server error while fetching shared profiles"
        });
    }
}

/**
 * Fetches profile data from the shared profile data store
 */
async function fetchSharedProfileData(profileId: string): Promise<any | null> {
    try {
        const profileDataKey = `sharedProfileData:${profileId}`;
        const profileData = await kv.get(profileDataKey);

        console.log(`📦 Profile data lookup for ${profileDataKey}: ${profileData ? 'Found' : 'Not found'}`);

        return profileData;
    } catch (error) {
        console.error(`❌ Error fetching shared profile data for ${profileId}:`, error);
        return null;
    }
}

/**
 * Formats raw profile data into the expected UserProfile structure
 */
function formatSharedProfile(profileData: any, profileId: string): UserProfile {
    const currentTimestamp = new Date().toISOString();

    return {
        id: profileData.id || profileId,
        name: profileData.name || `Shared Profile ${profileId.slice(-8)}`,
        business: profileData.business || '',
        USP: profileData.USP || '',
        persona: profileData.persona || '',
        challenges: profileData.challenges || '',
        websiteUrl: profileData.websiteUrl || '',
        description: profileData.description || '',
        createdAt: profileData.createdAt || currentTimestamp,
        updatedAt: profileData.updatedAt || currentTimestamp,
        isOwned: false, // Always false for shared profiles
        ownerAddress: profileData.userAddress || profileData.ownerAddress || 'Unknown'
    };
}

/**
 * Debug function to help identify profile key patterns when data is missing
 */
async function debugProfileKeys(profileId: string): Promise<void> {
    try {
        const debugPattern = `*${profileId}*`;
        const debugScan = await kv.scan(0, {
            match: debugPattern,
            count: 20
        });

        console.log(`🔧 DEBUG: Found ${debugScan[1].length} keys containing "${profileId}":`);
        debugScan[1].forEach(key => console.log(`   - ${key}`));

        // Check for alternative key patterns
        const alternativeKeys = [
            `profile:${profileId}`,
            `userProfile:${profileId}`,
            `profiles:${profileId}`,
            profileId // Direct key
        ];

        for (const altKey of alternativeKeys) {
            const altData = await kv.get(altKey);
            if (altData) {
                console.log(`🔧 Found alternative data source: ${altKey}`);
                break;
            }
        }
    } catch (debugError) {
        console.error(`❌ Debug scan failed for ${profileId}:`, debugError);
    }
}
