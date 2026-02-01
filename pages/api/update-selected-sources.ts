import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { userId, selectedSources } = req.body;

    if (!userId || !selectedSources) {
        return res.status(400).json({ message: 'Missing required parameters.' });
    }

    try {
        await kv.set(`selectedSources1:${userId}`, selectedSources);
        return res.status(200).json({ message: 'Selected sources updated successfully.' });
    } catch (error) {
        console.error('Error updating selected sources:', error);
        return res.status(500).json({ message: 'Failed to update selected sources.' });
    }
}
