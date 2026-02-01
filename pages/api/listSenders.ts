import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "GET") {
            return res.status(405).json({ error: "Method not allowed. Use GET." });
        }

        const senderSet = new Set<string>();

        // Use scanIterator with a match pattern to fetch only keys starting with "Sender:"
        const iterator = kv.scanIterator({ match: "Sender:*" });
        for await (const key of iterator) {
            const prefix = "Sender:";
            if (key.startsWith(prefix)) {
                const senderKey = key.substring(prefix.length).trim();
                if (senderKey) {
                    senderSet.add(senderKey);
                }
            }
        }

        const senderKeys = Array.from(senderSet).sort((a, b) => a.localeCompare(b));
        return res.status(200).json({ senderKeys });
    } catch (error) {
        console.error("Error listing sender configs from KV:", error);
        return res.status(500).json({ error: "Failed to list sender configs." });
    }
}
