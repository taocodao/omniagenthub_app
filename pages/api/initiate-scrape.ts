// pages/api/initiate-scrape.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { normalizeUrl } from '../../utils/embeddings';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const userId = (req.headers['accountid'] as string) || 'anonymous';
    const { url, sharedUserIds } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, message: 'URL is required' });
    }

    try {
        // Normalize the URL
        const normalizedUrl = normalizeUrl(url);
        const jobId = `scrape-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const sourceKey = `scrape:${normalizedUrl}`;

        // Create initial shared users list
        const initialShared = Array.from(new Set([userId, ...(sharedUserIds || [])]));

        // Save job info to KV store
        await kv.set(`scrape-job:${jobId}`, {
            status: 'RUNNING',
            url: url,
            normalizedUrl: normalizedUrl,
            userId: userId,
            sharedUserIds: initialShared,
            sourceKey: sourceKey,
            startedAt: new Date().toISOString()
        });

        // Define webhook URL for completion notification
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
            `https://${process.env.VERCEL_URL}` ||
            'http://localhost:3000';

        const webhookUrl = `${baseUrl}/api/scrape-webhook`;

        // Define webhook with job ID in query parameters - avoids template variable issues
        const webhookDefinition = [{
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
            requestUrl: `${webhookUrl}?jobId=${encodeURIComponent(jobId)}`,
        }];

        const encodedWebhook = Buffer.from(JSON.stringify(webhookDefinition)).toString('base64');

        // Try sitemap URLs first (similar to the original implementation)
        const sitemapUrls = [
            `${url}/sitemap.xml`,
            `${url}/page-sitemap.xml`,
            `${url}/sitemap_index.xml`,
        ];

        // Start the Website Content Crawler via API
        const apifyUrl = `https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=${process.env.APIFY_API_TOKEN}&webhooks=${encodedWebhook}`;

        console.log(`Starting Apify crawler for: ${url}`);

        const apifyResponse = await fetch(apifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startUrls: [
                    ...sitemapUrls.map(sitemapUrl => ({ url: sitemapUrl })),
                    { url } // Add the main URL as well
                ],
                maxCrawlPages: 50,
                maxRequestsPerCrawl: 50,
                maxCrawlDepth: 2,
                maxConcurrency: 2,
                pageLoadTimeoutSecs: 30,
                waitUntil: ["domcontentloaded"]
            })
        });

        if (!apifyResponse.ok) {
            const errorData = await apifyResponse.json();
            throw new Error(`Apify API error: ${JSON.stringify(errorData)}`);
        }

        const apifyData = await apifyResponse.json();
        console.log(`Apify crawler started with run ID: ${apifyData.data.id}`);

        // Update job with Apify run details
        await kv.set(`scrape-job:${jobId}`, {
            status: 'RUNNING',
            url: url,
            normalizedUrl: normalizedUrl,
            userId: userId,
            sharedUserIds: initialShared,
            sourceKey: sourceKey,
            startedAt: new Date().toISOString(),
            apifyRunId: apifyData.data.id
        });

        return res.status(200).json({
            success: true,
            message: 'Website scraping initiated. Results will be processed in the background.',
            jobId: jobId
        });

    } catch (error) {
        console.error('Error initiating website scraping:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
