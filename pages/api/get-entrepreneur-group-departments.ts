// api/get-entrepreneur-group-departments.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const departments = await kv.smembers('entrepreneur-group:departments');
        res.status(200).json({ departments: departments || [] });
    } catch (error) {
        console.error('Error fetching entrepreneur group departments:', error);
        res.status(500).json({ message: 'Error fetching entrepreneur group departments' });
    }
}
