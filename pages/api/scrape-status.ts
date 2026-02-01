// pages/api/scrape-status.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

interface ScrapeJobDetails {
    normalizedUrl: string;
    userId: string;
    url: string;
    status: string;
    startedAt: string;
    apifyRunId?: string;
    completedAt?: string;
    pageCount?: number;
    sharedUserIds?: string[];
    error?: string;
}

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { jobId } = req.query;

        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({ error: 'Missing job ID' });
        }

        const jobDetails = await kv.get(`scrape-job:${jobId}`) as ScrapeJobDetails | null;

        if (!jobDetails) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Optional: Check if the requesting user has access to this job
        const userId = (req.headers['accountid'] as string)?.trim();
        if (userId && userId !== jobDetails.userId &&
            (!jobDetails.sharedUserIds || !jobDetails.sharedUserIds.includes(userId))) {
            return res.status(403).json({ error: 'Access denied to this job' });
        }

        // Return job status and details
        return res.status(200).json({
            jobId,
            url: jobDetails.url,
            normalizedUrl: jobDetails.normalizedUrl,
            status: jobDetails.status,
            startedAt: jobDetails.startedAt,
            completedAt: jobDetails.completedAt,
            pageCount: jobDetails.pageCount,
            error: jobDetails.error
        });

    } catch (error) {
        console.error('Error checking job status:', error);
        return res.status(500).json({
            error: 'Failed to check job status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
