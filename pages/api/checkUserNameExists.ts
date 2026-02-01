import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

/**
 * API endpoint to check if a user name already exists
 * GET /api/checkUserNameExists?userName=John
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { userName } = req.query;

    if (!userName || typeof userName !== 'string') {
        return res.status(400).json({ error: "userName query parameter is required" });
    }

    try {
        // Get all keys matching userName:* pattern
        const keys = await kv.keys("userName:*");

        if (keys.length === 0) {
            return res.status(200).json({ exists: false });
        }

        // Get all user names and check for duplicates (case-insensitive)
        const normalizedInput = userName.trim().toLowerCase();

        for (const key of keys) {
            const existingName = await kv.get(key) as string;
            if (existingName && existingName.toLowerCase() === normalizedInput) {
                return res.status(200).json({ exists: true, existingName });
            }
        }

        return res.status(200).json({ exists: false });
    } catch (error) {
        console.error("Error checking user name:", error);
        return res.status(500).json({ error: "Error checking user name" });
    }
}
