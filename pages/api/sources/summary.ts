// pages/api/sources/summary.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface SummaryRequest {
  userKey: string;
  userAddress: string;
  notebookId: string;
  sourceId: string;
}

interface QuivrQueryResponse {
  answer?: string;
  response?: string;
  [key: string]: any;
}

interface CachedSummary {
  summary: string;
  generated: string;
  sourceId: string;
  notebookId: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userKey, userAddress, notebookId, sourceId }: SummaryRequest = req.body;

    if (!userKey || !notebookId || !sourceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('📝 [SUMMARY] Fetching summary for:', { notebookId, sourceId });

    // Generate Redis key for summary storage
    const summaryKey = `summary:${userKey}:${notebookId}:${sourceId}`;

    // Check if summary already exists in cache
    const cachedSummary = await kv.get(summaryKey);
    if (cachedSummary) {
      console.log('✅ [SUMMARY] Found cached summary');
      
      if (typeof cachedSummary === 'string') {
        return res.json({ summary: cachedSummary, cached: true });
      } else {
        const cached = cachedSummary as CachedSummary;
        return res.json({ summary: cached.summary, cached: true });
      }
    }

    // Get source details from notebook data
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const notebook = typeof notebookData === 'string' ? JSON.parse(notebookData) : notebookData;
    const source = notebook.sources?.find((s: any) => s.id === sourceId);

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    console.log('📄 [SUMMARY] Generating summary for source:', source.title);

    // Call Quivr backend to get source content and generate summary
    try {
      const quivrUrl = process.env.NEXT_PUBLIC_QUIVR_API_BASE_URL || 'http://localhost:8001';
      
      // Query the source to get its content
      const queryResponse = await fetch(`${quivrUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userAddress,
          query: `Provide a brief 2-3 sentence summary of this document: ${source.title}`,
          brain_id: notebookId,
          max_tokens: 150,
        }),
      });

      let summary = '';

      if (queryResponse.ok) {
        // ✅ FIX: Properly type the response data
        const queryData = await queryResponse.json() as QuivrQueryResponse;
        summary = queryData.answer || queryData.response || 'Summary generation in progress...';
      } else {
        // Fallback: Create a basic summary from available metadata
        summary = `${source.type.charAt(0).toUpperCase() + source.type.slice(1)} source`;
        if (source.fileSize) summary += ` (${source.fileSize})`;
        if (source.sourceType) {
          summary += ` imported from ${source.sourceType}`;
        }
        summary += `. Added on ${source.dateCreated}.`;
      }

      // Store summary in cache
      const summaryData: CachedSummary = {
        summary,
        generated: new Date().toISOString(),
        sourceId,
        notebookId,
      };

      await kv.set(summaryKey, JSON.stringify(summaryData), {
        ex: 60 * 60 * 24 * 30, // Cache for 30 days
      });

      console.log('✅ [SUMMARY] Generated and cached summary');

      return res.json({
        summary,
        cached: false,
      });
    } catch (quivrError) {
      console.error('❌ [SUMMARY] Quivr API error:', quivrError);
      
      // Return a basic fallback summary
      const fallbackSummary = `${source.title} - ${source.type} source added on ${source.dateCreated}`;
      
      return res.json({
        summary: fallbackSummary,
        cached: false,
        fallback: true,
      });
    }
  } catch (error) {
    console.error('❌ [SUMMARY] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
