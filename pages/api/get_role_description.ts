// pages/api/get_role_description.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { get_role_desc } from '../../util/get_role_task_desc';
import getContentByLanguage from '../../util/get_content_by_language';

// Function to remove markdown characters like "**" or "_"
const stripMarkdown = (text: string) => {
    return text.replace(/(\*\*|__|_|\*|")/g, '');
};

// Helper function to create a timeout promise
const timeout = (ms: number) => {
    return new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { department, role, language } = req.body;

    if (
        !department ||
        !role ||
        !language ||
        typeof department !== 'string' ||
        typeof role !== 'string' ||
        typeof language !== 'string'
    ) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        // Create a promise for the main processing task
        const processingPromise = (async () => {
            // Get the role description in English
            const roleDesc = await get_role_desc(department, role);

            if (!roleDesc) {
                res.status(404).json({ error: 'Role description not found' });
                return;
            }

            // Get the translated content
            const contentKey = `role_desc:${department}:${role}`;
            const { content: translatedDesc } = await getContentByLanguage(contentKey, language, roleDesc);

            // Ensure translatedDesc is a string (use empty string as default if null)
            const cleanDescription = stripMarkdown(translatedDesc ?? '');

            res.status(200).json({ description: cleanDescription });
        })();

        // Create a timeout promise (14 seconds)
        const timeoutPromise = timeout(14000).then(() => {
            if (!res.writableEnded) {
                res.status(200).json({ message: 'Role description generation will take some time, Please come back later' });
            }
        });

        // Race the processing against the timeout
        await Promise.race([processingPromise, timeoutPromise]);

    } catch (error) {
        console.error('Error fetching role description:', error);
        if (!res.writableEnded) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
