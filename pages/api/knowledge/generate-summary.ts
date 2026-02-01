// pages/api/knowledge/generate-summary.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userKey, notebookId, sourceId } = req.body;

  if (!userKey || !notebookId || !sourceId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  console.log('🤖 [GENERATE-SUMMARY] Request:', { userKey, notebookId, sourceId });

  try {
    // Check if summary already exists in KV
    const summaryKey = `summary:${userKey}:${notebookId}:${sourceId}`;
    const existingSummary = await kv.get(summaryKey);

    if (existingSummary) {
      console.log('✅ [GENERATE-SUMMARY] Found existing summary in cache');
      return res.json({ 
        summary: typeof existingSummary === 'string' ? existingSummary : JSON.stringify(existingSummary),
        cached: true,
      });
    }

    // Get source content from notebook data
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData || typeof notebookData !== 'object') {
      throw new Error('Notebook not found');
    }

    const notebook = notebookData as any;
    const source = notebook.sources?.find((s: any) => s.id === sourceId);

    if (!source) {
      throw new Error('Source not found in notebook');
    }

    console.log('📄 [GENERATE-SUMMARY] Found source:', source.title);

    // Generate summary using OpenAI or Claude
    const summary = await generateSummaryWithAI(source);

    // Store summary in KV with 30-day expiration
    await kv.set(summaryKey, summary, { ex: 30 * 24 * 60 * 60 });

    console.log('✅ [GENERATE-SUMMARY] Generated and cached summary');

    return res.json({ summary, cached: false });
  } catch (error) {
    console.error('❌ [GENERATE-SUMMARY] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate summary',
    });
  }
}

async function generateSummaryWithAI(source: any): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    // Fallback to simple summary if no API key
    return `${source.type === 'file' ? 'File' : source.type === 'website' ? 'Website' : 'Text'} source: ${source.title || source.fileName || 'Untitled'}. ${source.fileSize ? `Size: ${source.fileSize}` : ''}`;
  }

  try {
    // Use OpenAI to generate a concise summary
    const prompt = `Generate a brief, informative summary (max 100 words) for this source:
    
Title: ${source.title || source.fileName}
Type: ${source.type}
${source.content ? `Content preview: ${source.content.substring(0, 500)}` : ''}
${source.url ? `URL: ${source.url}` : ''}

Summary:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, informative summaries of documents and sources.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error('No summary generated');
    }

    return summary;
  } catch (error) {
    console.error('❌ [GENERATE-SUMMARY] AI generation failed:', error);
    // Fallback to simple summary
    return `${source.type === 'file' ? 'File' : source.type === 'website' ? 'Website' : 'Text'} source containing ${source.title || source.fileName || 'content'}. ${source.fileSize ? `Size: ${source.fileSize}.` : ''} ${source.dateCreated ? `Created: ${source.dateCreated}.` : ''}`;
  }
}
