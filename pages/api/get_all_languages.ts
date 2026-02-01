import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const languages = await kv.get('available_languages');
        if (!languages) {
            const defaultLanguages = ['English', 'Español', '中文', 'العربية', 'हिन्दी', '日本語', '한국어'];
            await kv.set('available_languages', defaultLanguages);
            return res.status(200).json(defaultLanguages);
        }
        res.status(200).json(languages);
    } catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
