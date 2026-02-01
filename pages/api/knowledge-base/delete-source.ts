// pages/api/knowledge-base/delete-source.ts
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
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { sourceId, userKey, notebookId } = req.body;

    if (!sourceId || !userKey || !notebookId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: sourceId, userKey, or notebookId' 
      });
    }

    // Remove source from notebook
    const sourcesKey = `${userKey}:notebook:${notebookId}:sources`;
    const sourcesData = await kv.get(sourcesKey);

    let sourcesList: NotebookSource[] = [];
    if (sourcesData) {
      try {
        sourcesList = JSON.parse(sourcesData as string);
      } catch (e) {
        sourcesList = [];
      }
    }

    // Filter out the source to delete
    const updatedSources = sourcesList.filter(source => source.id !== sourceId);

    if (updatedSources.length === sourcesList.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Source not found' 
      });
    }

    // Update sources list
    await kv.set(sourcesKey, JSON.stringify(updatedSources));

    // Update notebook source count
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (notebookData) {
      const notebook = JSON.parse(notebookData as string);
      notebook.sourceCount = updatedSources.length;
      notebook.sources = updatedSources;
      await kv.set(notebookKey, JSON.stringify(notebook));
    }

    res.status(200).json({
      success: true,
      message: 'Source deleted successfully'
    });

  } catch (error) {
    console.error('Delete source error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Delete failed'
    });
  }
}
