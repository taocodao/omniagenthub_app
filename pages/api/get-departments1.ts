// api/get-departments.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const departmentKeys = await scanAllKeys('department:*');
        const departmentSet = new Set<string>();

        departmentKeys.forEach((key: string) => {
            const department = key.split(':')[1];
            if (department) {
                departmentSet.add(department);
            }
        });

        const departments = Array.from(departmentSet).sort();

        res.status(200).json(departments);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ message: 'Error fetching departments' });
    }
}
