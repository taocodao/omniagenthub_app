import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { department } = req.body;

        if (!department) {
            return res.status(400).json({ message: 'Department is required' });
        }

        const departmentRolesKey = `department:${department}:roles`;
        let roles: string[] = await kv.get(departmentRolesKey)
            .then((res: any) => {
                //console.log(`Department roles fetched for key: ${departmentRolesKey}`, res);
                return res;
            });

        res.status(200).json({ roles });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Error fetching roles' });
    }
}

