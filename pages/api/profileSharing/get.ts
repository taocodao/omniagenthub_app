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
    const profileId = req.query.profileId as string;
    if (!profileId) {
        return res.status(400).json({ error: "Missing profileId parameter" });
    }

    try {
        const key = `sharedProfiles:${profileId}`;
        console.log("Inside profileSharing get.ts the key is ", key);
        const data = await kv.get(key);
        console.log("Inside profileSharing get.ts the data is ", data);
        const userAddresses: string[] = data ? (data as string[]) : [];

        const selectedSources = await Promise.all(
            userAddresses.map(async (address) => {
                const userName = await kv.get(`userName:${address}`);
                return {
                    userAddress: address,
                    userName: userName || address
                };
            })
        );
        console.log("Inside profileSharing get.ts the return is ", selectedSources);
        res.status(200).json({ selectedSources });
    } catch (error) {
        console.error("Error retrieving shared profile users:", error);
        res.status(500).json({ error: "Error retrieving shared profile users" });
    }
}
