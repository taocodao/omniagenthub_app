// pages/api/request-scrape.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { inngest } from './inngest/index';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the user ID from the header (default to 'anonymous')
    const userId = (req.headers['accountid'] as string) || 'anonymous';

    // Ensure the request includes a URL in the body
    const { url, sharedUserIds } = req.body as { url: string; sharedUserIds?: string[] };

    if (!url) {
        return res.status(400).json({ error: 'Missing "url" in request body.' });
    }

    try {
        // Send the event to Inngest to trigger the scrape function
        await inngest.send({
            name: 'website.scrape',
            data: {
                url,
                userId,
                sharedUserIds: sharedUserIds || []
            }
        });

        return res.status(200).json({
            status: "processing",
            message: "Website scraping started. Results will be processed in the background."
        });
    } catch (error) {
        console.error('Failed to send scrape event:', error);
        return res.status(500).json({
            error: 'Failed to initiate scrape',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
