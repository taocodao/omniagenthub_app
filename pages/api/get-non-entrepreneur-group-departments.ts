// api/get-non-entrepreneur-group-departments.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { kv, scanAllKeys } from '../../utils/redis-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Get all departments
        const departmentKeys = await scanAllKeys('department:*');
        const allDepartments = new Set<string>();

        departmentKeys.forEach((key: string) => {
            const department = key.split(':')[1];
            if (department) {
                allDepartments.add(department);
            }
        });

        // Get entrepreneur group departments
        const entrepreneurDepartments = await kv.smembers('entrepreneur-group:departments');
        const entrepreneurSet = new Set(entrepreneurDepartments || []);

        // Filter out entrepreneur group departments
        const nonEntrepreneurDepartments = Array.from(allDepartments)
            .filter(dept => !entrepreneurSet.has(dept))
            .sort();

        res.status(200).json({ departments: nonEntrepreneurDepartments });
    } catch (error) {
        console.error('Error fetching non-entrepreneur group departments:', error);
        res.status(500).json({ message: 'Error fetching non-entrepreneur group departments' });
    }
}
