import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { CLIENT_ID } from '../../constants/constants'; // Import CLIENT_ID constant

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;
    const { smartWalletAddress, username } = req.body;

    if (method === 'POST') {
        if (!smartWalletAddress) {
            return res.status(400).json({ error: 'Smart wallet address is required' });
        }

        // Include CLIENT_ID in keys
        const walletKey = `wallet:${smartWalletAddress}:${CLIENT_ID}`;
        const usernameKey = `username1:${username}:${CLIENT_ID}`;

        try {
            // Check if the smart wallet address is already registered
            const existingUsername = await kv.get<string>(walletKey);
            if (existingUsername) {
                return res.status(200).json({ username: existingUsername });
            }

            // If a username is provided, check if it's already taken
            if (username) {
                const usernameExists = await kv.get<string>(usernameKey);
                if (usernameExists) {
                    return res.status(409).json({ error: 'Username already taken' });
                }

                // Register the new username and smart wallet address
                await kv.set(usernameKey, smartWalletAddress);
                await kv.set(walletKey, username);
                return res.status(201).json({ username });
            }

            return res.status(400).json({ error: 'Username is required' });
        } catch (error) {
            console.error("Error during registration:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
}
