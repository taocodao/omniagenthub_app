import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { userAddress, profileId, profileData } = req.body as {
        userAddress: string;
        profileId: string;
        profileData?: any; // NEW: Include the actual profile data
    };

    if (!userAddress || !profileId) {
        return res.status(400).json({ error: "Missing userAddress or profileId" });
    }

    try {
        const key = `sharedProfiles:${profileId}`;
        let current: string[] = [];
        const data = await kv.get(key);
        console.log("Inside profileSharing add.ts data is ", data);
        console.log("Inside profileSharing add.ts key is ", key);
        if (data) current = data as string[];
        if (!current.includes(userAddress)) {
            current.push(userAddress);
            await kv.set(key, current);
        }
        // NEW: Also store the actual profile data for shared access
        if (profileData) {
            const profileDataKey = `sharedProfileData:${profileId}`;
            await kv.set(profileDataKey, profileData);
            console.log(`✅ Stored profile data under key: ${profileDataKey}`);
        } else {
            console.log(`⚠️ No profile data provided for sharing`);
        }


        res.status(200).json({ message: "Added shared user successfully", selectedSources: current });
    } catch (error) {
        console.error("Error adding shared profile user:", error);
        res.status(500).json({ error: "Error adding shared profile user" });
    }
}
