import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { userAddress, userName } = req.body as { userAddress: string; userName: string };
    if (!userAddress || !userName) {
        return res.status(400).json({ error: "userAddress and userName are required" });
    }

    try {
        await kv.set(`userName:${userAddress}`, userName);
        return res.status(200).json({ userName });
    } catch (error) {
        console.error("Error setting user name:", error);
        return res.status(500).json({ error: "Error setting user name" });
    }
}
