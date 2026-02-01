// pages/api/update-translation.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

// Initialize the Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the response data type
type Data = {
    success: boolean;
    message: string;
    updatedContent?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    console.log(`Received ${req.method} request at /api/update-translation`);

    if (req.method !== 'POST') {
        console.log(`Method ${req.method} not allowed.`);
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { name, content, language } = req.body;

    console.log('Request Body:', req.body);

    // Validate the input parameters
    if (!name || !content || !language) {
        console.log('Missing name, content, or language in the request.');
        return res.status(400).json({ success: false, message: 'Missing name, content, or language.' });
    }

    if (typeof name !== 'string' || typeof content !== 'string' || typeof language !== 'string') {
        console.log('Invalid data types for name, content, or language.');
        return res.status(400).json({ success: false, message: 'Invalid data types for name, content, or language.' });
    }

    try {
        // **Construct the key using the name and language**
        const key = `content:${name}:${language}`;
        console.log(`Updating key: ${key} with content: "${content}"`);

        // **Check if the key exists**
        const existingContent = await kv.get(key);
        if (existingContent === null) {
            console.error(`Key not found: ${key}`);
            return res.status(404).json({ success: false, message: 'Key not found.' });
        }

        // **Update the Translation in Vercel KV**
        await kv.set(key, content);
        console.log(`Successfully set the key: ${key}`);

        // **Retrieve the Updated Content to Verify**
        const updatedContent = await kv.get<string>(key);
        console.log(`Retrieved updated content for key ${key}: "${updatedContent}"`);

        if (updatedContent !== content) {
            console.error(`Mismatch after update. Expected: "${content}", Found: "${updatedContent}"`);
            throw new Error('Failed to verify the updated content.');
        }

        // **Return the Success Response**
        return res.status(200).json({
            success: true,
            message: 'Translation updated successfully.',
            updatedContent,
        });
    } catch (error) {
        console.error('Error updating translation:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}
