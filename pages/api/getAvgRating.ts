import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { department, role } = req.body;

    if (!department || !role) {
        return res.status(400).json({ message: 'Department and role are required' });
    }

    try {
        // Use the 'rating:' prefix to ensure only rating keys are fetched
        const pattern = `rating:*:${department}:${role}`;
        const keys = await scanAllKeys(pattern);

        if (keys.length === 0) {
            return res.status(200).json({ averageRating: 0 });
        }

        const ratings = await Promise.all(keys.map(key => kv.get<number>(key)));

        // Type guard to ensure only numbers are processed
        const validRatings = ratings.filter((rating): rating is number => typeof rating === 'number');

        const averageRating = validRatings.length
            ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length
            : 0;

        //console.log(`📊 Calculated average rating for department "${department}", role "${role}": ${averageRating}`);

        return res.status(200).json({ averageRating });
    } catch (error) {
        console.error('Error fetching ratings from KV database:', error);
        return res.status(500).json({ message: 'Error fetching ratings from KV database.' });
    }
}
