// pages/api/updateUsage.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

// Initialize the Vercel KV client with environment variables
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the structure of the incoming request
interface UpdateUsageRequest {
    department: string;
    role: string;
    initialCount?: number; // Optional parameter to set the usage count
    increment?: number;    // Optional parameter to increment the usage count
}

// Define the structure of the response
interface UpdateUsageResponse {
    usage: number;
    message?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<UpdateUsageResponse | { message: string }>
) {
    // Allow only POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Function to determine if the request is from localhost
    const isLocalhostRequest = (): boolean => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : '';
        const remoteAddress = req.socket.remoteAddress || '';

        // Check for localhost IP addresses
        return (
            ip === '127.0.0.1' ||
            ip === '::1' ||
            remoteAddress === '127.0.0.1' ||
            remoteAddress === '::1' ||
            req.headers.host?.includes('localhost') === true
        );
    };

    // Determine if the request is from localhost
    const isLocalhost = isLocalhostRequest();

    // If not localhost, verify the secret token
    if (!isLocalhost) {
        const token = req.headers['x-updater-token'];

        if (typeof token !== 'string' || token !== process.env.UPDATER_SECRET_TOKEN) {
            return res.status(401).json({ message: 'Unauthorized: Invalid or missing token.' });
        }
    }

    // Destructure parameters from the request body
    const { department, role, initialCount, increment } = req.body as UpdateUsageRequest;

    // Validate the presence of required parameters
    if (!department || !role) {
        return res.status(400).json({ message: 'Department and role are required.' });
    }

    // Ensure that either initialCount or increment is provided, but not both
    if (
        (initialCount === undefined && increment === undefined) ||
        (initialCount !== undefined && increment !== undefined)
    ) {
        return res.status(400).json({ message: 'Provide either initialCount or increment, but not both.' });
    }

    // If initialCount is provided, validate it
    if (initialCount !== undefined) {
        if (typeof initialCount !== 'number' || initialCount < 0) {
            return res.status(400).json({ message: 'initialCount must be a non-negative number.' });
        }
    }

    // If increment is provided, validate it
    if (increment !== undefined) {
        if (typeof increment !== 'number' || increment < 0) {
            return res.status(400).json({ message: 'increment must be a positive number.' });
        }
    }

    // Construct the unique key for the department and role
    const key = `${department}:${role}:usage`;

    try {
        let newUsage: number;

        if (initialCount !== undefined) {
            // Set the usage count to initialCount
            newUsage = initialCount;
            await kv.set(key, newUsage);
        } else if (increment !== undefined) {
            // Fetch the current usage count
            const currentUsage = (await kv.get<number>(key)) || 0;

            // Calculate the new usage count
            newUsage = currentUsage + increment;

            // Update the usage count in KV
            await kv.set(key, newUsage);
        } else {
            // This case should never occur due to earlier validation
            return res.status(400).json({ message: 'Invalid request parameters.' });
        }

        // Respond with the updated usage count
        return res.status(200).json({ usage: newUsage });
    } catch (error: any) {
        console.error('Error updating usage:', error);
        return res.status(500).json({ message: 'Error updating usage.' });
    }
}
