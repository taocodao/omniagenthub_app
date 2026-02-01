// pages/api/update-role-name.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

require('dotenv').config(); // Load environment variables

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

    const { department, oldRole, newRole } = req.body;

    if (!department || !oldRole || !newRole) {
        return res.status(400).json({ message: 'Department, oldRole, and newRole are required' });
    }

    try {
        // Define keys based on consistent naming convention
        const oldRoleKey = `department:${department}:role:${oldRole}`;
        const newRoleKey = `department:${department}:role:${newRole}`;

        // Check if newRole exists
        // const newRoleExists = await kv.exists(`${newRoleKey}:APIkey`);
        // if (!newRoleExists) {
        //     return res.status(400).json({ message: 'The new role does not exist. Please enter an existing role name.' });
        // }

        // Get tasks associated with the oldRole
        const oldRoleTasksKey = `${oldRoleKey}:tasks`;
        let tasks: string[] = await kv.get(oldRoleTasksKey)
            .then((res: any) => {
                if (Array.isArray(res)) {
                    return res;
                } else if (typeof res === 'string') {
                    if (isValidJSON(res)) {
                        return JSON.parse(res);
                    }
                    return [];
                }
                return [];
            });

        console.log(`Tasks fetched for key ${oldRoleTasksKey}:`, tasks);

        if (tasks.length === 0) {
            return res.status(400).json({ message: 'No tasks found for the selected role.' });
        }

        // Move tasks from oldRole to newRole
        for (const task of tasks) {
            const oldAssistantId = `${department}:${oldRole}:${task}`;
            const newAssistantId = `${department}:${newRole}:${task}`;

            // Get the instruction for the old assistant
            const instructionKey = `instruction:${oldAssistantId}`;
            const instruction = await kv.get(instructionKey);

            if (instruction === null) {
                console.warn(`Instruction not found for ${oldAssistantId}`);
                continue; // Skip if instruction not found
            }

            // Save instruction under new assistant ID
            const newInstructionKey = `instruction:${newAssistantId}`;
            await kv.set(newInstructionKey, instruction);

            // Delete the old instruction
            await kv.del(instructionKey);
        }

        // Update tasks list for newRole
        const newRoleTasksKey = `${newRoleKey}:tasks`;
        let newRoleTasks: string[] = await kv.get(newRoleTasksKey)
            .then((res: any) => {
                if (Array.isArray(res)) {
                    return res;
                } else if (typeof res === 'string') {
                    if (isValidJSON(res)) {
                        return JSON.parse(res);
                    }
                    return [];
                }
                return [];
            });

        // Add tasks to newRoleTasks if not already present
        for (const task of tasks) {
            if (!newRoleTasks.includes(task)) {
                newRoleTasks.push(task);
            }
        }

        await kv.set(newRoleTasksKey, JSON.stringify(newRoleTasks));

        // Delete the old tasks key
        await kv.del(oldRoleTasksKey);

        return res.status(200).json({ message: 'Role updated and tasks moved successfully.' });
    } catch (error: any) {
        console.error('Error updating role:', error);
        return res.status(500).json({ message: 'Error updating role.', error: error.message });
    }
}
