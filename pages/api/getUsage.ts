// pages/api/getUsage.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface GetUsageRequest {
    department: string;
    role: string;
}

interface GetUsageResponse {
    usage: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<GetUsageResponse | { message: string }>) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { department, role } = req.body as GetUsageRequest;

    if (!department || !role) {
        return res.status(400).json({ message: 'Department and role are required' });
    }

    const key = `${department}:${role}:usage`;

    try {
        const usage = await kv.get<number>(key) || 0;
        return res.status(200).json({ usage });
    } catch (error) {
        console.error('Error fetching usage:', error);
        return res.status(500).json({ message: 'Error fetching usage' });
    }
}
