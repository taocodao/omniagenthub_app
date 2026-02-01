// pages/api/delete-role.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

// Initialize KV Client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed. Use POST.' });
    }

    const { department, role } = req.body;

    if (!department || !role) {
        return res.status(400).json({ message: 'Department and Role are required.' });
    }

    const departmentRolesKey = `department:${department}:roles`;
    const roleTasksKey = `department:${department}:role:${role}:tasks`;

    try {
        // Fetch existing roles
        const rolesData = await kv.get(departmentRolesKey);
        let roles: string[] = [];
        if (rolesData) {
            if (typeof rolesData === 'string') {
                roles = JSON.parse(rolesData);
            } else if (Array.isArray(rolesData)) {
                roles = rolesData;
            }
        }

        // Remove the role from the roles array
        roles = roles.filter((r) => r !== role);

        // Save the updated roles array
        await kv.set(departmentRolesKey, JSON.stringify(roles));

        // Fetch tasks associated with the role
        const tasksData = await kv.get(roleTasksKey);
        let tasks: string[] = [];
        if (tasksData) {
            if (typeof tasksData === 'string') {
                tasks = JSON.parse(tasksData);
            } else if (Array.isArray(tasksData)) {
                tasks = tasksData;
            }
        }

        // Delete instructions associated with each task
        for (const task of tasks) {
            const assistantKey = `${department}:${role}:${task}`;
            const instructionKey = `assistant:${assistantKey}:instructions`;
            await kv.del(instructionKey);
        }

        // Delete the tasks key for the role
        await kv.del(roleTasksKey);

        return res.status(200).json({ message: 'Role deleted successfully.' });
    } catch (error) {
        console.error('Error deleting role:', error);
        return res.status(500).json({ message: 'Error deleting role.' });
    }
}
