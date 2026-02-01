// pages/api/notebooks/list.ts - COMPLETELY FIXED VERSION
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface Notebook {
  id: string;
  title: string;
  sources: any[];
  created: string;
  sourceCount: number;
  pineconeAssistantName?: string;
  lastUpdated: string;
  userAddress?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey } = req.query;

    console.log('Fetching notebooks for userKey:', userKey);

    if (!userKey || typeof userKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters. userKey is required.'
      });
    }

    // Get user's notebook IDs
    const notebooksKey = `${userKey}:notebooks`;
    console.log('Looking for notebooks at key:', notebooksKey);

    const notebookIds = await kv.get(notebooksKey);
    console.log('Raw notebook IDs from KV:', notebookIds, 'Type:', typeof notebookIds);

    let notebooks: Notebook[] = [];
    let parsedIds: string[] = [];

    // ✅ CRITICAL FIX: Handle both string and array data from KV
    if (notebookIds) {
      try {
        if (typeof notebookIds === 'string') {
          // If it's a string, parse it as JSON
          parsedIds = JSON.parse(notebookIds);
          console.log('Parsed notebook IDs from string:', parsedIds);
        } else if (Array.isArray(notebookIds)) {
          // If it's already an array, use it directly
          parsedIds = notebookIds;
          console.log('Using notebook IDs as array:', parsedIds);
        } else {
          console.warn('Unexpected notebook IDs format:', typeof notebookIds, notebookIds);
          parsedIds = [];
        }
      } catch (parseError) {
        console.error('Error parsing notebook IDs:', parseError);
        parsedIds = [];
      }
    } else {
      console.log('No notebook IDs found - user has no notebooks yet');
      parsedIds = [];
    }

    // Fetch all notebook details
    if (parsedIds.length > 0) {
      console.log(`Found ${parsedIds.length} notebook ID(s), fetching details...`);

      for (const notebookId of parsedIds) {
        try {
          const notebookKey = `${userKey}:notebook:${notebookId}`;
          console.log('Fetching notebook:', notebookKey);

          const notebookData = await kv.get(notebookKey);

          if (notebookData) {
            let notebook: Notebook;

            if (typeof notebookData === 'string') {
              notebook = JSON.parse(notebookData);
            } else if (typeof notebookData === 'object') {
              notebook = notebookData as Notebook;
            } else {
              console.warn(`Unexpected notebook data format for ${notebookId}:`, typeof notebookData);
              continue;
            }

            console.log('Found notebook:', { id: notebook.id, title: notebook.title });

            // Ensure sources array exists and validate data
            if (!notebook.sources) {
              notebook.sources = [];
            }
            if (!Array.isArray(notebook.sources)) {
              console.warn(`Invalid sources format for ${notebookId}, resetting to empty array`);
              notebook.sources = [];
            }

            // Update source count from actual sources array
            notebook.sourceCount = notebook.sources.length;

            // Ensure all required fields exist
            if (!notebook.id) notebook.id = notebookId;
            if (!notebook.title) notebook.title = 'Untitled Notebook';
            if (!notebook.created) notebook.created = 'Unknown';
            if (!notebook.lastUpdated) notebook.lastUpdated = new Date().toISOString();

            notebooks.push(notebook);
          } else {
            console.warn(`Notebook data not found for ID: ${notebookId}`);
          }
        } catch (error) {
          console.error(`Error fetching individual notebook ${notebookId}:`, error);
          // Continue with other notebooks instead of failing completely
        }
      }
    }

    console.log(`✅ Successfully fetched ${notebooks.length} notebooks`);

    return res.status(200).json({
      success: true,
      notebooks,
      count: notebooks.length,
      debug: {
        userKey,
        notebooksKey,
        rawNotebookIds: notebookIds,
        rawDataType: typeof notebookIds,
        parsedIds,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching notebooks:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
