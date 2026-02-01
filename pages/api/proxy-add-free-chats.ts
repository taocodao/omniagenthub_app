// pages/api/proxy-add-free-chats.ts

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/add-free-chats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-updater-token': process.env.UPDATER_SECRET_TOKEN!,
            },
            body: JSON.stringify(req.body),
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}
