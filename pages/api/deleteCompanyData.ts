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

    try {
        // Delete all companyName: mappings
        let cursor = "0"; // Changed to string type
        do {
            const result = await kv.scan(cursor, { match: "companyName:*" });
            cursor = result[0];
            const keys = result[1];
            if (keys.length > 0) await kv.del(...keys);
        } while (cursor !== "0"); // Compare with string zero

        // Delete companyNames array
        await kv.del("companyNames");

        // Delete all companyUsers: mappings
        cursor = "0"; // Changed to string type
        do {
            const result = await kv.scan(cursor, { match: "companyUsers:*" });
            cursor = result[0];
            const keys = result[1];
            if (keys.length > 0) await kv.del(...keys);
        } while (cursor !== "0"); // Compare with string zero

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting company data:", error);
        return res.status(500).json({ error: "Error deleting company data" });
    }
}
