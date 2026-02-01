// pages/api/notebooks/delete.ts - WITH EMPTY CHECK

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, notebookId } = req.body;
    console.log('Delete notebook request:', { userKey, notebookId });

    if (!userKey || !notebookId) {
      return res.status(400).json({
        success: false,
        message: 'userKey and notebookId are required'
      });
    }

    // Check if notebook exists
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      return res.status(404).json({
        success: false,
        message: 'Notebook not found'
      });
    }

    // Get notebook details
    let notebook: any;
    try {
      if (typeof notebookData === 'string') {
        notebook = JSON.parse(notebookData);
      } else {
        notebook = notebookData;
      }
    } catch (e) {
      console.error('Error parsing notebook data:', e);
    }

    // ✅ NEW: Check if notebook has sources
    const sources = notebook?.sources || [];
    if (sources.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete notebook with sources. Please remove all sources first.',
        sourceCount: sources.length
      });
    }

    // Delete notebook data
    await kv.del(notebookKey);
    console.log('Deleted notebook:', notebookKey);

    // Remove from user's notebooks list
    const notebooksKey = `${userKey}:notebooks`;
    const existingNotebooks = await kv.get(notebooksKey);

    if (existingNotebooks) {
      let notebooksList: string[] = [];
      try {
        if (typeof existingNotebooks === 'string') {
          notebooksList = JSON.parse(existingNotebooks);
        } else if (Array.isArray(existingNotebooks)) {
          notebooksList = existingNotebooks;
        }

        // Remove the notebook ID from the list
        notebooksList = notebooksList.filter(id => id !== notebookId);

        // Update the list
        if (notebooksList.length > 0) {
          await kv.set(notebooksKey, notebooksList);
        } else {
          await kv.del(notebooksKey);
        }

        console.log('Updated notebooks list:', notebooksList);
      } catch (e) {
        console.error('Error updating notebooks list:', e);
      }
    }

    console.log(`✅ Notebook ${notebookId} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: 'Notebook deleted successfully',
      deletedNotebookId: notebookId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting notebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
