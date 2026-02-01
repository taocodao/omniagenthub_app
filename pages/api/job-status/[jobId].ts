// pages/api/job-status/[jobId].ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

// Define interface matching your job structure
interface ScrapeJobDetails {
    normalizedUrl: string;
    userId: string;
    url: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    apifyRunId?: string;
    pineconeNamespace?: string;
    pineconeIndexName?: string;
    sharedUserIds?: string[];
}

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { jobId } = req.query;

    try {
        const job = await kv.get(`scrape-job:${jobId}`) as ScrapeJobDetails;

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.status(200).json({
            id: jobId,
            status: job.status,
            userId: job.userId,
            url: job.url,
            normalizedUrl: job.normalizedUrl,
            apifyRunId: job.apifyRunId,
            startedAt: job.startedAt,
            completedAt: job.completedAt
        });

    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({
            error: 'Failed to check job status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
