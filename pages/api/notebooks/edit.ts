// pages/api/notebooks/edit.ts - NEW FILE FOR EDITING NOTEBOOK TITLE

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, notebookId, title } = req.body;

    if (!userKey || !notebookId || !title) {
      return res.status(400).json({
        success: false,
        message: 'userKey, notebookId, and title are required'
      });
    }

    // Get notebook
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      return res.status(404).json({
        success: false,
        message: 'Notebook not found'
      });
    }

    // Parse and update
    let notebook: any;
    if (typeof notebookData === 'string') {
      notebook = JSON.parse(notebookData);
    } else {
      notebook = notebookData;
    }

    notebook.title = title.trim();
    notebook.lastUpdated = new Date().toISOString();

    // Save
    await kv.set(notebookKey, JSON.stringify(notebook));

    return res.status(200).json({
      success: true,
      message: 'Notebook updated successfully',
      notebook
    });

  } catch (error) {
    console.error('Error editing notebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
