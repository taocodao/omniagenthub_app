import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

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
    const { department, role, task, prompt } = req.body;

    if (!prompt || !role || !task || !department) {
        console.log('Department, Role, Task, and Prompt are required');
        return res.status(400).json({ message: 'Department, Role, Task, and Prompt are required' });
    }

    const assistantId = HashUtil.hashTo(`${role}${task}`);

    try {
        await kv.set(`assistant:${assistantId}:instructions`, prompt);

        // Update Role -> Task mapping
        const roleTasksKey = `department:${department}:role:${role}:tasks`;
        let tasks: string[] = await kv.get(roleTasksKey)
            .then((res: any) => {
                console.log(`Role tasks fetched for key: ${roleTasksKey}`, res);
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

        if (!tasks.includes(task)) {
            tasks.push(task);
            await kv.set(roleTasksKey, JSON.stringify(tasks));
        }

        return res.status(200).json({ message: 'Prompt added successfully', instruction: prompt });
    } catch (error) {
        console.error('Error saving prompt to KV database:', error);
        return res.status(500).json({ message: 'Error saving prompt to KV database.' });
    }
}
