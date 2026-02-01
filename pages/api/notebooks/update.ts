// pages/api/notebooks/update.ts - COMPLETE FIXED VERSION
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
    const { userKey, notebookId, updates, userAddress } = req.body;

    console.log('Update notebook request:', { userKey, notebookId, updates, userAddress });

    if (!userKey || !notebookId || !updates) {
      return res.status(400).json({
        success: false,
        message: 'userKey, notebookId, and updates are required'
      });
    }

    // Get existing notebook
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      return res.status(404).json({
        success: false,
        message: 'Notebook not found'
      });
    }

    let notebook;
    try {
      if (typeof notebookData === 'string') {
        notebook = JSON.parse(notebookData);
      } else {
        notebook = notebookData;
      }
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Invalid notebook data format'
      });
    }

    // Apply updates
    const updatedNotebook = {
      ...notebook,
      ...updates,
      lastUpdated: new Date().toISOString(),
      id: notebookId // Ensure ID cannot be changed
    };

    // Ensure sources is always an array
    if (!Array.isArray(updatedNotebook.sources)) {
      updatedNotebook.sources = [];
    }

    // Update source count
    updatedNotebook.sourceCount = updatedNotebook.sources.length;

    // Save updated notebook
    await kv.set(notebookKey, JSON.stringify(updatedNotebook));

    console.log(`✅ Notebook ${notebookId} updated successfully`);

    return res.status(200).json({
      success: true,
      message: 'Notebook updated successfully',
      notebook: updatedNotebook,
      debug: {
        notebookKey,
        updatedFields: Object.keys(updates),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error updating notebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
