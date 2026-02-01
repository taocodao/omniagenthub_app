// pages/api/update-role-department.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const isValidJSON = (str: string) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { currentDepartment, role, newDepartment } = req.body;

    if (!currentDepartment || !role || !newDepartment) {
        return res.status(400).json({ message: 'currentDepartment, role, and newDepartment are required' });
    }

    try {
        // Step 1: Update the department-role mappings

        // Remove the role from the current department's role list
        const currentDeptRolesKey = `department:${currentDepartment}:roles`;
        let currentDeptRoles: string[] = await kv.get(currentDeptRolesKey)
            .then((res: any) => {
                if (Array.isArray(res)) return res;
                if (typeof res === 'string') {
                    try {
                        return JSON.parse(res);
                    } catch {
                        return [];
                    }
                }
                return [];
            });

        currentDeptRoles = currentDeptRoles.filter((r) => r !== role);
        await kv.set(currentDeptRolesKey, JSON.stringify(currentDeptRoles));

        // Add the role to the new department's role list
        const newDeptRolesKey = `department:${newDepartment}:roles`;
        let newDeptRoles: string[] = await kv.get(newDeptRolesKey)
            .then((res: any) => {
                if (Array.isArray(res)) return res;
                if (typeof res === 'string') {
                    try {
                        return JSON.parse(res);
                    } catch {
                        return [];
                    }
                }
                return [];
            });

        if (!newDeptRoles.includes(role)) {
            newDeptRoles.push(role);
            await kv.set(newDeptRolesKey, JSON.stringify(newDeptRoles));
        }

        // **Additional Code Starts Here**

        // 1. Store the old department before updating
        const oldDepartment = currentDepartment;

        // 2. Refresh departments, roles, and tasks
        // Assuming `handleRefreshDepartments` and `fetchRoles` are defined elsewhere in your code
        // These functions should refresh the state in your frontend application
        // Since this is an API route, you might not need these. If they are not applicable, you can omit them.

        // 3. Fetch tasks from the old department
        const roleTasksKey = `department:${oldDepartment}:role:${role}:tasks`;

        const tasks: string[] = await kv.get(roleTasksKey).then((res: any) => {
            console.log(`Tasks fetched for key ${roleTasksKey}:`, res);
            if (res === null || res === undefined) {
                return [];
            } else if (Array.isArray(res)) {
                return res;
            } else if (typeof res === 'string' && isValidJSON(res)) {
                return JSON.parse(res);
            } else {
                console.warn(`Invalid data for key ${roleTasksKey}: ${res}`);
                return [];
            }
        });

        // 4. Save tasks under the new department
        const newTasksKey = `department:${newDepartment}:role:${role}:tasks`;
        await kv.set(newTasksKey, JSON.stringify(tasks));

        /* 5. Move each task's instruction data to the new department
        for (const taskName of tasks) {
            const oldInstructionKey = `task:${oldDepartment}:role:${role}:${taskName}`;
            const newInstructionKey = `task:${newDepartment}:role:${role}:${taskName}`;

            const instructionValue = await kv.get(oldInstructionKey);
            if (instructionValue !== null) {
                await kv.set(newInstructionKey, instructionValue);
                await kv.del(oldInstructionKey);
            }
        }*/

        // 6. Delete the old tasks key
        await kv.del(roleTasksKey);

        // **Additional Code Ends Here**

        return res.status(200).json({ message: 'Role department updated successfully' });
    } catch (error) {
        console.error('Error updating role department:', error);
        return res.status(500).json({ message: 'Error updating role department.' });
    }
}
