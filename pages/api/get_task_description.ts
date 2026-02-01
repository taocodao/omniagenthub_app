// pages/api/get_task_description.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { get_task_desc } from '../../util/get_role_task_desc';
import getContentByLanguage from '../../util/get_content_by_language';

// Helper function to create a timeout promise
const timeout = (ms: number) => {
    return new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { department, role, task, language } = req.body;

    if (
        !department ||
        !role ||
        !task ||
        !language ||
        typeof department !== 'string' ||
        typeof role !== 'string' ||
        typeof task !== 'string' ||
        typeof language !== 'string'
    ) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        // Create a promise for the main processing task
        const processingPromise = (async () => {
            // Get the task description in English
            const taskDesc = await get_task_desc(department, role, task);

            if (!taskDesc) {
                res.status(404).json({ error: 'Task description not found' });
                return;
            }

            // Get the translated content
            const contentKey = `task_desc:${department}:${role}:${task}`;
            const { content: translatedDesc } = await getContentByLanguage(contentKey, language, taskDesc);

            // Respond with the translated description
            res.status(200).json({ description: translatedDesc });
        })();

        // Create a timeout promise (14 seconds)
        const timeoutPromise = timeout(14000).then(() => {
            if (!res.writableEnded) {
                res.status(200).json({ message: 'It is being processed, please come back later.' });
            }
        });

        // Race the processing against the timeout
        await Promise.race([processingPromise, timeoutPromise]);

    } catch (error) {
        console.error('Error fetching task description:', error);
        if (!res.writableEnded) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
