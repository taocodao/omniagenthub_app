//api/selectedSources/add.ts
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
    const { userAddress, sourceKey } = req.body as { userAddress: string; sourceKey: string };
    if (!userAddress || !sourceKey) {
        return res.status(400).json({ error: "Missing userAddress or sourceKey" });
    }
    try {
        const key = `selectedSources1:${userAddress}`;
        let current: string[] = [];
        const data = await kv.get(key);
        if (data) current = data as string[];
        if (!current.includes(sourceKey)) {
            current.push(sourceKey);
            await kv.set(key, current);
        }
        res.status(200).json({ selectedSources: current });
    } catch (error) {
        console.error("Error adding selected source:", error);
        res.status(500).json({ error: "Error adding selected source" });
    }
}
