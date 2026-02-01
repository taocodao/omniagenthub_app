// pages/api/knowledge-base/create-notebook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../../util/hashToFixedDigits';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface CreateNotebookRequest {
  userKey: string;
  title: string;
}

interface Notebook {
  id: string;
  title: string;
  sources: any[];
  created: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  sourceCount: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, title } = req.body as CreateNotebookRequest;

    if (!userKey || !title?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request parameters. userKey and title are required.' 
      });
    }

    // Generate notebook ID
    const notebookId = `notebook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create notebook object
    const notebook: Notebook = {
      id: notebookId,
      title: title.trim(),
      sources: [],
      created: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      role: 'Owner',
      sourceCount: 0
    };

    // Store notebook in KV
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    await kv.set(notebookKey, JSON.stringify(notebook));

    // Add to user's notebooks list
    const userNotebooksKey = `${userKey}:notebooks`;
    const existingNotebooks = await kv.get(userNotebooksKey);
    let notebooksList: string[] = [];

    if (existingNotebooks) {
      try {
        notebooksList = JSON.parse(existingNotebooks as string);
      } catch (e) {
        notebooksList = [];
      }
    }

    notebooksList.unshift(notebookId); // Add to beginning for "recent" order
    await kv.set(userNotebooksKey, JSON.stringify(notebooksList));

    return res.status(200).json({
      success: true,
      message: 'Notebook created successfully',
      notebook
    });

  } catch (error) {
    console.error('Error creating notebook:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error.' 
    });
  }
}
