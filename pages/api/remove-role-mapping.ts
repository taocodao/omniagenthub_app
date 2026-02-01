import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { userAddress, department, role } = req.body;

    if (!userAddress || !department || !role) {
        return res.status(400).json({ message: 'User address, department, and role are required' });
    }

    //const key = `${userAddress}:${department}:${role}`;
    const key = `favorite:${userAddress}:${department}:${role}`;
    try {
        await kv.del(key); // Remove the mapping
        return res.status(200).json({ message: 'Role mapping removed successfully' });
    } catch (error) {
        console.error('Error removing role mapping from KV database:', error);
        return res.status(500).json({ message: 'Error removing role mapping from KV database.' });
    }
}
