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

    const { userAddress, profileId } = req.body as { userAddress: string; profileId: string };
    if (!userAddress || !profileId) {
        return res.status(400).json({ error: "Missing userAddress or profileId" });
    }

    try {
        const key = `sharedProfiles:${profileId}`;
        let current: string[] = [];
        const data = await kv.get(key);
        if (data) current = data as string[];
        const updated = current.filter((s) => s !== userAddress);
        await kv.set(key, updated);
        res.status(200).json({ message: "Removed shared user successfully", selectedSources: updated });
    } catch (error) {
        console.error("Error removing shared profile user:", error);
        res.status(500).json({ error: "Error removing shared profile user" });
    }
}
