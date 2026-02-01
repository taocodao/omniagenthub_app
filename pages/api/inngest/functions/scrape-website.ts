// pages/api/inngest/functions/scrape-website.ts
import { inngest } from '../index';
import { ApifyClient } from 'apify-client';
import { createClient } from '@vercel/kv';
import { normalizeUrl, cleanText, truncateText, createAndStoreEmbeddings } from '../../../../utils/embeddings';

// Initialize Apify client with optimal configuration
const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN!,
    timeoutSecs: 120, // 2-minute timeout for API calls
});

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the scrape website function
export const scrapeWebsite = inngest.createFunction(
    {
        id: 'scrape-website',
        retries: 3, // Retry up to 3 times on failure
        concurrency: 1, // Process one scrape job at a time
        idempotency: 'event.data.url', // Prevent duplicate scrapes of the same URL
    },
    { event: 'website.scrape' },
    async ({ event, step, logger }) => {
        const { url, userId, sharedUserIds } = event.data;

        // Log the start of the process
        logger.info('Starting website scrape', { url, userId });

        // Step 1: Normalize the URL
        const normalizedUrl = await step.run('normalize-url', () => {
            return normalizeUrl(url);
        });

        // Step 2: Attempt sitemap crawling
        let items: any[] = [];
        let sitemapCrawlSuccess = false;

        const sitemapUrls = [
            `${url}/sitemap.xml`,
            `${url}/page-sitemap.xml`,
            `${url}/sitemap_index.xml`,
        ];

        // Try each sitemap URL sequentially
        for (const sitemapUrl of sitemapUrls) {
            if (sitemapCrawlSuccess) break;

            try {
                logger.info('Attempting sitemap crawl', { sitemapUrl });

                // Run the Apify actor to crawl the sitemap
                const scrapeRun = await step.run(`crawl-sitemap-${sitemapUrls.indexOf(sitemapUrl)}`, async () => {
                    return await apifyClient.actor('apify/website-content-crawler').call({
                        startUrls: [{ url: sitemapUrl }],
                        maxCrawlPages: 50,
                        maxRequestsPerCrawl: 50,
                        maxCrawlDepth: 2,
                        maxConcurrency: 2, // Limit concurrent requests
                        pageLoadTimeoutSecs: 30, // Timeout for loading individual pages
                    });
                });

                // Fetch the dataset with crawled pages
                const dataset = await step.run(`fetch-dataset-${sitemapUrls.indexOf(sitemapUrl)}`, async () => {
                    return await apifyClient.dataset(scrapeRun.defaultDatasetId).listItems();
                });

                // If we got results, mark as success
                if (dataset.items && dataset.items.length > 0) {
                    items = dataset.items;
                    sitemapCrawlSuccess = true;
                    logger.info('Sitemap crawl succeeded', {
                        sitemapUrl,
                        pageCount: items.length,
                        firstPageUrl: items[0]?.url
                    });
                }
            } catch (error) {
                logger.warn('Failed to crawl sitemap', {
                    sitemapUrl,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Step 3: If sitemap crawling failed, try fallback pages
        if (!sitemapCrawlSuccess || items.length === 0) {
            logger.info('No valid sitemap found, using fallback pages');

            // Define common pages to try
            const fallbackPages = [
                { url },
                { url: `${url}/about` },
                { url: `${url}/services` },
                { url: `${url}/products` },
                { url: `${url}/solutions` },
            ];

            try {
                const fallbackRun = await step.run('crawl-fallback-pages', async () => {
                    return await apifyClient.actor('apify/website-content-crawler').call({
                        startUrls: fallbackPages,
                        maxCrawlPages: 10,
                        maxCrawlDepth: 1,
                    });
                });

                const dataset = await step.run('fetch-fallback-dataset', async () => {
                    return await apifyClient.dataset(fallbackRun.defaultDatasetId).listItems();
                });

                items = dataset.items || [];
                logger.info('Fallback crawl completed', { pageCount: items.length });
            } catch (error) {
                logger.error('Failed to run fallback crawl', {
                    error: error instanceof Error ? error.message : String(error),
                });
                // Even if fallback fails, continue with any items we might have
            }
        }

        // Step 4: Create version and prepare for processing
        const version = Date.now();
        const initialShared: string[] = Array.from(new Set([userId, ...(sharedUserIds || [])]));
        const sourceKey = `scrape:${normalizedUrl}`;

        // Step 5: Process pages in batches to avoid timeouts
        const BATCH_SIZE = 5; // Process 5 pages at a time
        logger.info('Beginning page processing', {
            totalPages: items.length,
            batchSize: BATCH_SIZE
        });

        // Process in batches
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(items.length / BATCH_SIZE);

            await step.run(`process-batch-${batchNumber}`, async () => {
                logger.info(`Processing batch ${batchNumber}/${totalBatches}`);

                const batch = items.slice(i, i + BATCH_SIZE);
                await Promise.allSettled(
                    batch.map(async (item, idx) => {
                        const itemUrl = item.url as string;
                        if (!itemUrl) return;

                        const rawText = item.text || '';
                        if (!rawText.trim()) {
                            logger.debug('Skipping empty page', { itemUrl });
                            return;
                        }

                        const cleanedText = cleanText(rawText);
                        const finalText = cleanedText.split(' ').length > 3000
                            ? truncateText(cleanedText, 3000)
                            : cleanedText;

                        // Store embeddings for each shared user
                        await Promise.all(
                            initialShared.map(async (uid) => {
                                try {
                                    await createAndStoreEmbeddings(uid, sourceKey, finalText, version + i + idx, true);
                                    logger.debug('Processed embeddings', { itemUrl, userID: uid });
                                } catch (error) {
                                    logger.error('Error storing embeddings', {
                                        itemUrl,
                                        userID: uid,
                                        error: error instanceof Error ? error.message : String(error),
                                    });
                                }
                            })
                        );
                    })
                );
            });

            // Log progress after each batch
            logger.info(`Completed batch ${batchNumber}/${totalBatches}`);
        }

        // Step 6: Update metadata
        await step.run('update-metadata', async () => {
            // Update website metadata
            interface WebsiteMetadata {
                scrapedAt: string;
                pageCount: number;
            }

            await kv.set(`website:${normalizedUrl}`, {
                scrapedAt: new Date().toISOString(),
                pageCount: items.length,
            } as WebsiteMetadata);

            // Save version info
            await kv.set(`lastScrapeVersion:${userId}:${normalizedUrl}`, version);

            // Update access mapping
            await kv.set(`embeddingMapping:${sourceKey}`, initialShared);

            // Update owner mapping
            await kv.set(`embeddingOwner:${sourceKey}`, userId);

            // Update global embedding index
            const indexKey = 'embeddingIndex1';
            let currentIndex = (await kv.get(indexKey)) as string[] | null;

            if (!currentIndex) {
                currentIndex = [];
            }

            if (!currentIndex.includes(sourceKey)) {
                currentIndex.push(sourceKey);
                await kv.set(indexKey, currentIndex);
            }

            logger.info('Metadata updated successfully', {
                sourceKey,
                userCount: initialShared.length
            });
        });

        // Return success response
        return {
            success: true,
            message: `Scraping complete. Processed ${items.length} pages from ${url}.`,
            sourceKey,
            pageCount: items.length,
            timestamp: new Date().toISOString()
        };
    }
);
