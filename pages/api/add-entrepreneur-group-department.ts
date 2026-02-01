// api/add-entrepreneur-group-department.ts
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

        // Add department to the entrepreneur group set
        await kv.sadd('entrepreneur-group:departments', department);

        res.status(200).json({
            message: 'Department added to entrepreneur group successfully',
            department
        });
    } catch (error) {
        console.error('Error adding department to entrepreneur group:', error);
        res.status(500).json({ message: 'Error adding department to entrepreneur group' });
    }
}
