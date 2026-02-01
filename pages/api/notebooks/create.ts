// pages/api/notebooks/create.ts
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
  lastUpdated: string;
  userAddress: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, title, userAddress } = req.body;

    console.log('🎯 [Create] Request:', { userKey, title, userAddress: userAddress?.substring(0, 10) + '...' });

    if (!userKey || !title?.trim() || !userAddress) {
      return res.status(400).json({
        success: false,
        message: 'userKey, title, and userAddress are required'
      });
    }

    const notebookId = `nb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const notebook: Notebook = {
      id: notebookId,
      title: title.trim(),
      sources: [],
      created: now,
      sourceCount: 0,
      lastUpdated: now,
      userAddress: userAddress
    };

    // Save notebook
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    console.log('💾 [Create] Saving to:', notebookKey);
    
    await kv.set(notebookKey, JSON.stringify(notebook));

    // Verify
    const verify = await kv.get(notebookKey);
    if (!verify) {
      throw new Error('Failed to save notebook');
    }
    console.log('✅ [Create] Verified notebook saved');

    // Update notebooks list
    const notebooksKey = `${userKey}:notebooks`;
    let notebooksList: string[] = [];
    
    const existing = await kv.get(notebooksKey);
    if (existing) {
      if (typeof existing === 'string') {
        notebooksList = JSON.parse(existing);
      } else if (Array.isArray(existing)) {
        notebooksList = existing;
      }
    }

    notebooksList.unshift(notebookId);
    await kv.set(notebooksKey, notebooksList);

    console.log('✅ [Create] Notebook created:', notebookId);

    return res.status(200).json({
      success: true,
      message: 'Notebook created successfully',
      notebook
    });

  } catch (error: any) {
    console.error('❌ [Create] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create notebook',
      error: error.message
    });
  }
}
