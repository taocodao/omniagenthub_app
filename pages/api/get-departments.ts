import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const departmentKeys = await scanAllKeys('department:*');
        const departmentSet = new Set<string>();

        departmentKeys.forEach((key: string) => {
            const department = key.split(':')[1];
            departmentSet.add(department);
        });

        const departments = Array.from(departmentSet);

        res.status(200).json(departments);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ message: 'Error fetching departments' });
    }
}
