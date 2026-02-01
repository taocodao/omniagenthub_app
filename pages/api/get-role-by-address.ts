//get-role-by-address.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { kv, scanAllKeys } from '../../utils/redis-helpers';




export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { address } = req.body;

    if (!address) {
        return res.status(400).json({ message: 'Address is required' });
    }

    try {
        //const keys = await scanAllKeys(`${address}:*:*`);
        const keys = await scanAllKeys(`favorite:${address}:*:*`);
        const departmentRoles = keys.map(key => {
            const [dummy, userAddress, department, role] = key.split(':');
            return { department, role };
        });

        return res.status(200).json(departmentRoles);
    } catch (error) {
        console.error('Error fetching role mappings from KV database:', error);
        return res.status(500).json({ message: 'Error fetching role mappings from KV database.' });
    }
}
