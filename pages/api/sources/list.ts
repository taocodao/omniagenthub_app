// pages/api/sources/list.ts - MISSING FILE FOR LOADING SOURCES
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface NotebookSource {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  fileSize?: string;
  dateCreated: string;
  error?: string;
  url?: string;
  fileName?: string;
  content?: string;
  selected: boolean;
  pineconeFileId?: string;
  embeddingId?: string; // ✅ NEW: Individual embedding ID with hierarchical naming
  fileType?: string; // ✅ NEW: File extension/type
  embeddingPath?: string; // ✅ NEW: userAddress->notebookName->sourceName
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, notebookId } = req.query;

    console.log('🔍 Loading sources for:', { userKey, notebookId });

    if (!userKey || typeof userKey !== 'string' || !notebookId || typeof notebookId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters. userKey and notebookId are required.'
      });
    }

    // Get notebook data which includes sources
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    console.log('📖 Fetching notebook at key:', notebookKey);
    
    const notebookData = await kv.get(notebookKey);
    
    if (!notebookData) {
      console.log('❌ Notebook not found at key:', notebookKey);
      return res.status(404).json({
        success: false,
        message: 'Notebook not found'
      });
    }

    let notebook: any;
    if (typeof notebookData === 'string') {
      try {
        notebook = JSON.parse(notebookData);
      } catch (parseError) {
        console.error('❌ Error parsing notebook data:', parseError);
        return res.status(500).json({
          success: false,
          message: 'Invalid notebook data format'
        });
      }
    } else {
      notebook = notebookData;
    }

    // Extract sources from notebook - THIS IS THE CRITICAL PART
    const sources: NotebookSource[] = notebook.sources || [];
    console.log('✅ Found', sources.length, 'sources in notebook data');
    console.log('📋 Sources data:', JSON.stringify(sources, null, 2));

    return res.status(200).json({
      success: true,
      sources,
      count: sources.length,
      notebookId,
      debug: {
        userKey,
        notebookId,
        notebookKey,
        notebookTitle: notebook.title,
        notebookSourceCount: notebook.sourceCount,
        actualSourcesFound: sources.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error loading sources:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
