// pages/api/notebooks/get.ts - COMPLETELY FIXED VERSION
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, notebookId } = req.query;

    console.log('Getting notebook:', { userKey, notebookId });

    if (!userKey || !notebookId || typeof userKey !== 'string' || typeof notebookId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters. userKey and notebookId are required.'
      });
    }

    // Get notebook
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    console.log('Fetching notebook from key:', notebookKey);

    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      console.error('Notebook not found:', notebookKey);
      return res.status(404).json({
        success: false,
        message: 'Notebook not found.'
      });
    }

    let notebook;
    if (typeof notebookData === 'string') {
      notebook = JSON.parse(notebookData);
    } else if (typeof notebookData === 'object') {
      notebook = notebookData;
    } else {
      console.error('Invalid notebook data format:', typeof notebookData);
      return res.status(500).json({
        success: false,
        message: 'Invalid notebook data format.'
      });
    }

    console.log('Found notebook:', { id: notebook.id, title: notebook.title });

    // Ensure sources array exists
    if (!notebook.sources) {
      notebook.sources = [];
    }
    if (!Array.isArray(notebook.sources)) {
      console.warn('Invalid sources format, resetting to empty array');
      notebook.sources = [];
    }

    // Update source count from the actual sources array
    notebook.sourceCount = notebook.sources.length;

    return res.status(200).json({
      success: true,
      notebook,
      debug: {
        notebookKey,
        sourceCount: notebook.sourceCount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching notebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
