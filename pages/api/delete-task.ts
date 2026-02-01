// pages/api/delete-task.ts

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

    const { department, role, task } = req.body;

    if (!department || !role || !task) {
        return res.status(400).json({ message: 'Department, Role, and Task are required.' });
    }

    const roleTasksKey = `department:${department}:role:${role}:tasks`;

    try {
        // Fetch existing tasks
        const tasksData = await kv.get(roleTasksKey);
        let tasks: string[] = [];
        if (tasksData) {
            if (typeof tasksData === 'string') {
                tasks = JSON.parse(tasksData);
            } else if (Array.isArray(tasksData)) {
                tasks = tasksData;
            }
        }

        // Remove the task from the tasks array
        tasks = tasks.filter((t) => t !== task);

        // Save the updated tasks array
        await kv.set(roleTasksKey, JSON.stringify(tasks));

        // Delete the instruction associated with the task
        const assistantKey = `${department}:${role}:${task}`;
        const instructionKey = `assistant:${assistantKey}:instructions`;
        await kv.del(instructionKey);

        return res.status(200).json({ message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('Error deleting task:', error);
        return res.status(500).json({ message: 'Error deleting task.' });
    }
}
