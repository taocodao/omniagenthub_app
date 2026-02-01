import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { CLIENT_ID } from '../../constants/constants'; // Import CLIENT_ID constant

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: "Username is required" });
        }

        try {
            // Include CLIENT_ID in the key
            const key = `username1:${username}:${CLIENT_ID}`;
            const accountAddress = await kv.get<string>(key);

            if (accountAddress) {
                return res.status(200).json({ accountAddress });
            } else {
                return res.status(404).json({ error: "Username not found" });
            }
        } catch (error) {
            console.error("Error fetching account address:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
