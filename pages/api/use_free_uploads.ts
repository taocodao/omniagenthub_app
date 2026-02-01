// pages/api/use_free_uploads.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the structure of the request body
interface UseFreeUploadsRequest {
    userKey: string;
    uploadCount?: number; // Number of uploads to deduct, default to 1
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Allow only POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { userKey, uploadCount = 1 } = req.body as UseFreeUploadsRequest;

    if (!userKey) {
        return res.status(400).json({ message: 'User key is required.' });
    }

    try {
        const hashedUserKey = HashUtil.hashTo(userKey);

        const freeUploadsKey = `${hashedUserKey}:freeUploads`;

        // Get current free uploads as string
        const currentFreeUploadsNum = await kv.get<number>(freeUploadsKey);
        const currentFreeUploads = currentFreeUploadsNum !== null ? Number(currentFreeUploadsNum) : 0;

        if (currentFreeUploads >= uploadCount) {
            // Deduct the upload count
            const newFreeUploads = currentFreeUploads - uploadCount;
            await kv.set(freeUploadsKey, newFreeUploads.toString());
            return res.status(200).json({ success: true, remainingFreeUploads: newFreeUploads });
        } else {
            return res.status(200).json({ success: false, message: 'Insufficient free uploads.', remainingFreeUploads: currentFreeUploads });
        }
    } catch (error: any) {
        console.error('Error using free uploads:', error);
        return res.status(500).json({ message: 'Failed to process free uploads.', error: error.message });
    }
}
