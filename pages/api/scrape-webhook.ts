// pages/api/scrape-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { Pinecone } from '@pinecone-database/pinecone';
import { cleanText, truncateText, createAndStoreEmbeddings } from '../../utils/embeddings';

// Define interface for job details
interface ScrapeJobDetails {
    normalizedUrl: string;
    userId: string;
    url: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    datasetId?: string;
    apifyRunId?: string;
    sharedUserIds?: string[];
    sourceKey?: string;
}

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Initialize Pinecone client with modern SDK
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
});

const logger = {
    info: (message: string, data?: any) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
    },
    error: (message: string, data?: any) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, data ? data : '');
    },
    warn: (message: string, data?: any) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? data : '');
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    logger.info('Webhook handler received request', {
        method: req.method,
        url: req.url
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        // Get jobId from query parameters
        const jobId = req.query.jobId as string;

        if (!jobId) {
            logger.error('No job ID provided in webhook');
            return res.status(400).json({ success: false, message: 'Job ID required' });
        }

        logger.info(`Processing webhook for job ID: ${jobId}`);

        // Get job details from KV store
        const jobDetails = await kv.get(`scrape-job:${jobId}`) as ScrapeJobDetails | null;

        if (!jobDetails) {
            logger.warn(`Job not found: ${jobId}`);
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        logger.info('Retrieved job details', { jobDetails });

        // Determine event type from request or use a default value
        const eventType = req.body.eventType || req.query.eventType;
        const isSuccess = eventType === 'ACTOR.RUN.SUCCEEDED';

        // Get the Apify run ID either from the job details or the webhook payload
        const runId = jobDetails.apifyRunId || req.body.runId;

        if (!runId) {
            logger.error('No run ID available');
            return res.status(400).json({ success: false, message: 'Run ID required' });
        }

        // Update job status
        await kv.set(`scrape-job:${jobId}`, {
            ...jobDetails,
            status: isSuccess ? 'SUCCEEDED' : 'FAILED',
            completedAt: new Date().toISOString()
        });

        // If the job failed, just return
        if (!isSuccess) {
            logger.warn(`Job failed: ${jobId}`);
            return res.status(200).json({ success: false, message: 'Job failed' });
        }

        // Get the dataset ID from the run or the webhook payload
        let datasetId = req.body.datasetId;
        let runData: any = null;

        if (!datasetId || datasetId?.includes('{{')) {
            logger.info(`Fetching run details for run ID: ${runId}`);
            const runResponse = await fetch(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${process.env.APIFY_API_TOKEN}`
            );

            if (!runResponse.ok) {
                logger.error('Failed to retrieve run details', { status: runResponse.status });
                throw new Error('Failed to retrieve run details from Apify');
            }

            runData = await runResponse.json();
            datasetId = runData?.data?.defaultDatasetId;

            if (!datasetId) {
                logger.error('No dataset ID found in run details');
                throw new Error('No dataset ID found in run details');
            }
        }

        // Get the dataset items
        logger.info(`Fetching dataset items for dataset ID: ${datasetId}`);
        const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${process.env.APIFY_API_TOKEN}`
        );

        if (!datasetResponse.ok) {
            logger.error('Failed to retrieve dataset items', { status: datasetResponse.status });
            throw new Error('Failed to retrieve dataset items from Apify');
        }

        const items = await datasetResponse.json();
        logger.info(`Retrieved ${items.length} items from dataset`);

        // Process the items
        const version = Date.now();
        const userId = jobDetails.userId;
        const normalizedUrl = jobDetails.normalizedUrl;
        const sourceKey = jobDetails.sourceKey || `scrape:${normalizedUrl}`;
        const initialShared = Array.from(new Set([userId, ...(jobDetails.sharedUserIds || [])]));

        // Process each scraped page
        let processedCount = 0;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.url || !item.text) {
                logger.warn(`Skipping item with missing URL or text: ${item.url}`);
                continue;
            }

            const cleanedText = cleanText(item.text);
            const finalText = cleanedText.split(' ').length > 3000
                ? truncateText(cleanedText, 3000)
                : cleanedText;

            // Create embeddings for all shared users
            for (const uid of initialShared) {
                try {
                    await createAndStoreEmbeddings(uid, sourceKey, finalText, version + i, true);
                    processedCount++;
                } catch (err) {
                    logger.error(`Failed to create embeddings for user ${uid}`, { error: err });
                }
            }

            // Log progress periodically
            if (i % 10 === 0 || i === items.length - 1) {
                logger.info(`Processed ${i + 1}/${items.length} items`);
            }
        }

        logger.info(`Successfully processed ${processedCount} embeddings`);

        // Update metadata
        await kv.set(`website:${normalizedUrl}`, {
            scrapedAt: new Date().toISOString(),
            pageCount: items.length,
        });

        await kv.set(`lastScrapeVersion:${userId}:${normalizedUrl}`, version);
        await kv.set(`embeddingMapping:${sourceKey}`, initialShared);
        await kv.set(`embeddingOwner:${sourceKey}`, userId);

        // Update global embedding index
        const indexKey = 'embeddingIndex1';
        const indexData = await kv.get(indexKey);
        let currentIndex: string[] = Array.isArray(indexData) ? indexData : [];

        if (!currentIndex.includes(sourceKey)) {
            currentIndex.push(sourceKey);
            await kv.set(indexKey, currentIndex);
            logger.info(`Added ${sourceKey} to global embedding index`);
        }

        logger.info('Webhook processing completed successfully');
        return res.status(200).json({ success: true });

    } catch (error) {
        logger.error('Error processing webhook', { error });
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
