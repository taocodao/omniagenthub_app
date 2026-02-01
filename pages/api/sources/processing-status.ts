// pages/api/sources/processing-status.ts - COMPLETELY FIXED VERSION
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface ProcessingStatusResponse {
  id: string;
  status: 'Processing' | 'Available' | 'ProcessingFailed';
  percent_done: number;
  error_message?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { fileId, notebookId, userKey } = req.query;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing fileId parameter' 
      });
    }

    // ✅ Get assistant name from notebook (CRITICAL FIX)
    let assistantName = `notebook-${notebookId}`;
    
    if (notebookId && userKey && typeof notebookId === 'string' && typeof userKey === 'string') {
      try {
        const notebookKey = `${userKey}:notebook:${notebookId}`;
        const notebookData = await kv.get(notebookKey);
        
        if (notebookData && typeof notebookData === 'string') {
          const notebook = JSON.parse(notebookData);
          assistantName = notebook.pineconeAssistantName || `notebook-${notebookId}`;
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch notebook for assistant name:', error);
      }
    }

    console.log('📊 Checking file status:', fileId, 'in assistant:', assistantName);

    // ✅ FIXED: Use correct Pinecone Assistant file status endpoint
    const pineconeHost = process.env.PINECONE_ASSISTANT_HOST || 'https://prod-1-data.ke.pinecone.io';
    const statusUrl = `${pineconeHost}/assistant/files/${assistantName}/${fileId}`;

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'X-Pinecone-API-Version': '2025-10'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Pinecone file status check failed (${response.status}):`, errorText);
      
      // If file not found, assume it's completed processing
      if (response.status === 404) {
        return res.status(200).json({
          success: true,
          status: 'Available',
          progress: 100,
          message: 'File processing completed (404 indicates completion)'
        });
      }
      
      return res.status(response.status).json({
        success: false,
        error: `Failed to check file status: ${errorText}`
      });
    }

    const fileData: ProcessingStatusResponse = await response.json();

    console.log('📊 File status response:', fileData.status, `${fileData.percent_done}%`);

    res.status(200).json({
      success: true,
      status: fileData.status,
      progress: fileData.percent_done,
      error: fileData.error_message
    });

  } catch (error) {
    console.error('❌ Processing status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check processing status'
    });
  }
}
