// pages/api/checkUploadName.ts
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
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { name, userAddress } = req.query;

    if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Missing or invalid name parameter" });
    }

    if (!userAddress || typeof userAddress !== "string") {
        return res.status(400).json({ error: "Missing or invalid userAddress parameter" });
    }

    try {
        // Normalize the name to match uploadFile.ts storage format
        const normalizedName = name.trim().toLowerCase();

        // Create the key pattern used in uploadFile.ts for user-specific metadata
        const userDocKey = `upload:${normalizedName}:${userAddress}`;

        // Check if this user already has a document with this name
        const existingDoc = await kv.get(userDocKey);

        return res.status(200).json({
            exists: !!existingDoc,
            suggestedName: existingDoc ? `${name}-${Date.now()}` : null
        });

    } catch (error) {
        console.error("Error checking document name:", error);
        return res.status(500).json({ error: "Error checking document name" });
    }
}
