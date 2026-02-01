// pages/api/scrape_web.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ApifyClient } from 'apify-client';
import { createClient } from '@vercel/kv';
import { normalizeUrl, cleanText, truncateText, createAndStoreEmbeddings } from '../../utils/embeddings';

// Validate required environment variables
if (!process.env.APIFY_API_TOKEN || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error('Missing required environment variables');
}

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the user ID from the header (default to 'anonymous')
  const userId = (req.headers['accountid'] as string) || 'anonymous';

  // Ensure the request includes a URL in the body.
  const { url, sharedUserIds } = req.body as { url: string; sharedUserIds?: string[] };
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Immediately respond so the client is not blocked.
  res.status(200).json({ message: "Scrape initiated. Website embeddings will be updated when complete." });

  // Fire-and-forget background process.
  (async () => {
    try {
      // Normalize the URL (e.g. "https://web3aistore.com" becomes "web3aistore.com")
      const normalizedUrl = normalizeUrl(url);
      let items: any[] = [];
      let sitemapCrawlSuccess = false;

      // Try crawling sitemaps first.
      const sitemapUrls = [
        `${url}/sitemap.xml`,
        `${url}/page-sitemap.xml`,
        `${url}/sitemap_index.xml`,
      ];
      console.log(" sitemap urls is ", sitemapUrls);
      for (const sitemapUrl of sitemapUrls) {
        try {
          console.log(`Attempting to crawl sitemap: ${sitemapUrl}`);
          const scrapeRun = await apifyClient.actor('apify/website-content-crawler').call({
            startUrls: [{ url: sitemapUrl }],
            maxCrawlPages: 50,
            maxRequestsPerCrawl: 50,
            maxCrawlDepth: 2,
          });
          const dataset = await apifyClient.dataset(scrapeRun.defaultDatasetId).listItems();
          if (dataset.items && dataset.items.length > 0) {
            items = dataset.items;
            sitemapCrawlSuccess = true;
            console.log(`Sitemap crawl succeeded using ${sitemapUrl}, found ${items.length} pages.`);
            break;
          }
        } catch (error) {
          console.warn(`Failed to crawl sitemap at ${sitemapUrl}:`, error);
        }
      }

      // If no pages were found through sitemaps, use fallback popular pages.
      if (!sitemapCrawlSuccess || items.length === 0) {
        console.warn('No valid sitemap found. Using fallback popular pages.');
        const fallbackPages = [
          { url },
          { url: `${url}/about` },
          { url: `${url}/services` },
          { url: `${url}/products` },
          { url: `${url}/solutions` },
        ];
        const fallbackRun = await apifyClient.actor('apify/website-content-crawler').call({
          startUrls: fallbackPages,
          maxCrawlPages: 10,
          maxCrawlDepth: 1,
        });
        const dataset = await apifyClient.dataset(fallbackRun.defaultDatasetId).listItems();
        items = dataset.items;
      }

      // Create a version timestamp.
      const version = Date.now();
      // Merge the uploader's userId with any sharedUserIds provided.
      const initialShared: string[] = Array.from(new Set([userId, ...(sharedUserIds || [])]));
      // Use normalized URL to form the sourceKey and namespace.
      const sourceKey = `scrape:${normalizedUrl}`;

      // Process each scraped page separately.
      // Define interface for scraped items
      interface ScrapedItem {
        url: string;
        text?: string;
      }

      await Promise.allSettled(
        items.map(async (item: ScrapedItem, idx: number) => {
          const itemUrl = item.url;
          if (!itemUrl) return;
          const rawText = item.text || '';
          if (!rawText.trim()) {
            console.warn(`Skipping URL due to empty content: ${itemUrl}`);
            return;
          }
          const cleaned = cleanText(rawText);
          const finalText = cleaned.split(' ').length > 3000 ? truncateText(cleaned, 3000) : cleaned;
          // For each shared user, store embeddings for this page.
          await Promise.all(
            initialShared.map(async (uid: string) => {
              try {
                // Use version + idx to differentiate pages.
                await createAndStoreEmbeddings(uid, sourceKey, finalText, version + idx, true);
                console.log(`Processed embeddings for ${itemUrl} under namespace ${sourceKey}`);
              } catch (error) {
                console.error(`Error storing embeddings for ${itemUrl} under namespace ${sourceKey}:`, error);
              }
            })
          );
        })
      );

      // Update website metadata in KV.
      await kv.set(`website:${normalizedUrl}`, {
        scrapedAt: new Date().toISOString(),
        pageCount: items.length,
      });
      await kv.set(`lastScrapeVersion:${userId}:${normalizedUrl}`, version);

      // Update the access mapping: store the shared user IDs array.
      await kv.set(`embeddingMapping:${sourceKey}`, initialShared);
      // Update the owner mapping with the uploader’s userId.
      await kv.set(`embeddingOwner:${sourceKey}`, userId);

      // Update the global embedding index.
      const indexKey = "embeddingIndex1";
      let currentIndex: string[] = [];
      const indexData = await kv.get(indexKey);
      if (indexData) {
        currentIndex = indexData as string[];
      }
      if (!currentIndex.includes(sourceKey)) {
        currentIndex.push(sourceKey);
        await kv.set(indexKey, currentIndex);
      }

      console.log(`Scraping complete. Processed ${items.length} pages under namespace ${sourceKey}.`);
    } catch (error: unknown) {
      console.error('Background scrape error:');
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Unknown error occurred');
      }
    }
  })();
}
