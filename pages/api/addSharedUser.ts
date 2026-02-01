// pages/api/addSharedUser.ts
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
    // Expect body: { key, sharedUserId, owner }
    const { key, sharedUserId, owner } = req.body as {
        key: string;
        sharedUserId: string;
        owner: string;
    };
    if (!key || !sharedUserId || !owner) {
        return res.status(400).json({ error: "Missing parameters" });
    }
    // Check that the requester is the owner
    const currentOwner = await kv.get(`embeddingOwner:${key}`);
    if (!currentOwner) {
        return res.status(404).json({ error: "Embedding not found" });
    }
    if ((currentOwner as string).toLowerCase() !== owner.toLowerCase()) {
        return res.status(403).json({ error: "Only the owner can add shared user IDs" });
    }
    const accessData = await kv.get(`embeddingMapping:${key}`);
    if (!accessData) {
        return res.status(404).json({ error: "Embedding mapping not found" });
    }
    let shared = accessData as string[];
    if (!shared.includes(sharedUserId)) {
        shared.push(sharedUserId);
        await kv.set(`embeddingMapping:${key}`, shared);
    }
    res.status(200).json({ message: "Shared user added successfully", shared });
}
