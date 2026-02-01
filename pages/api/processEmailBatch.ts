// File: pages/api/processEmailBatch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { processEmail } from '../../lib/processEmail';
import PQueue from 'p-queue';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const processingQueue = new PQueue({
    concurrency: 1,
    timeout: 30000, // 30 second timeout per task
    throwOnTimeout: true
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { senderName, isProd } = req.body;
        if (!senderName) return res.status(400).json({ error: 'Missing senderName' });

        res.status(202).json({ message: 'Batch processing started' });

        const companyKeys = await getCompaniesWithRetry();
        const targetCompanies = isProd ? companyKeys : companyKeys.slice(0, 220);

        targetCompanies.forEach(companyName => {
            processingQueue.add(async () => {
                try {
                    // Wrap in timeout
                    await processWithTimeout(companyName, senderName, isProd);
                } catch (error) {
                    console.error(`Failed processing ${companyName}:`, error);
                    await kv.rpush('failed:companies', companyName);
                }
            });
        });

    } catch (error) {
        console.error('Batch initialization error:', error);
    }
}

async function processWithTimeout(
    company: string,
    sender: string,
    isProd: boolean
): Promise<void> {
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Processing timeout after 30 seconds')), 30000)
        );

        await Promise.race([
            processEmail(sender, company, undefined, undefined, isProd),
            timeoutPromise
        ]);

        console.log(`Successfully processed ${company}`);
    } catch (error) {
        console.error(`Processing failed for ${company}:`, error);
        throw error; // Propagate error to queue handler
    }
}

// Keep getCompaniesWithRetry unchanged
async function getCompaniesWithRetry(retries = 3): Promise<string[]> {
    try {
        const companySet = new Set<string>();
        let cursor = "0";

        do {
            const result = await kv.scan(cursor, {
                match: 'Company:*',
                count: 100
            });
            const newCursor = result[0];
            const keys = result[1];

            keys.forEach(key => companySet.add(key.replace('Company:', '')));
            cursor = newCursor;
        } while (cursor !== "0");

        return Array.from(companySet).sort();
    } catch (error) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return getCompaniesWithRetry(retries - 1);
        }
        throw error;
    }
}
