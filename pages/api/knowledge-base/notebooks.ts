// pages/api/knowledge-base/notebooks.ts
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
  role: 'Owner' | 'Editor' | 'Viewer';
  sourceCount: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey } = req.query;

    if (!userKey || typeof userKey !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request parameters. userKey is required.' 
      });
    }

    // Get user's notebook list
    const userNotebooksKey = `${userKey}:notebooks`;
    const notebooksListData = await kv.get(userNotebooksKey);

    let notebooksList: string[] = [];
    if (notebooksListData) {
      try {
        notebooksList = JSON.parse(notebooksListData as string);
      } catch (e) {
        notebooksList = [];
      }
    }

    // Get all notebook details
    const notebooks: Notebook[] = [];

    for (const notebookId of notebooksList) {
      const notebookKey = `${userKey}:notebook:${notebookId}`;
      const notebookData = await kv.get(notebookKey);

      if (notebookData) {
        try {
          const notebook = JSON.parse(notebookData as string) as Notebook;

          // Update source count from actual sources
          const sourcesKey = `${userKey}:notebook:${notebookId}:sources`;
          const sourcesData = await kv.get(sourcesKey);
          let sourcesList: any[] = [];

          if (sourcesData) {
            try {
              sourcesList = JSON.parse(sourcesData as string);
            } catch (e) {
              sourcesList = [];
            }
          }

          notebook.sources = sourcesList;
          notebook.sourceCount = sourcesList.length;
          notebooks.push(notebook);
        } catch (e) {
          console.error(`Error parsing notebook ${notebookId}:`, e);
        }
      }
    }

    return res.status(200).json({
      success: true,
      notebooks,
      count: notebooks.length
    });

  } catch (error) {
    console.error('Error fetching notebooks:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error.' 
    });
  }
}
