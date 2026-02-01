// api/remove-entrepreneur-group-department.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { department } = req.body;

        if (!department) {
            return res.status(400).json({ message: 'Department is required' });
        }

        // Remove department from the entrepreneur group set
        await kv.srem('entrepreneur-group:departments', department);

        res.status(200).json({
            message: 'Department removed from entrepreneur group successfully',
            department
        });
    } catch (error) {
        console.error('Error removing department from entrepreneur group:', error);
        res.status(500).json({ message: 'Error removing department from entrepreneur group' });
    }
}
