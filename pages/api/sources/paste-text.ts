// pages/api/sources/upload-text.ts - MINIMAL DEBUG VERSION
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
  selected: boolean;
  quivrDocId?: string;
  fileType?: string;
}

interface Notebook {
  id: string;
  title: string;
  sources: NotebookSource[];
  sourceCount: number;
  created: string;
  lastUpdated: string;
  userAddress: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🚀 [1] Handler started');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  console.log('✅ [2] Method is POST');

  try {
    console.log('📦 [3] Parsing body...');
    const { userKey, sourceId, notebookId, title, content, userAddress } = req.body;

    console.log('✅ [4] Body parsed');
    console.log('📝 [5] Title:', title);

    if (!userKey || !sourceId || !notebookId || !title || !content || !userAddress) {
      console.error('❌ [6] Missing parameters');
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    console.log('✅ [7] All params present');

    const notebookKey = `${userKey}:notebook:${notebookId}`;
    console.log('🔑 [8] Notebook key:', notebookKey);
    
    const notebookData = await kv.get(notebookKey);
    console.log('✅ [9] KV get completed');

    if (!notebookData || typeof notebookData !== 'string') {
      console.error('❌ [10] Notebook not found');
      return res.status(404).json({ success: false, error: 'Notebook not found' });
    }

    console.log('✅ [11] Notebook found, parsing...');
    const notebook: Notebook = JSON.parse(notebookData);
    console.log('✅ [12] Notebook parsed:', notebook.title);

    const contentLength = content.length;
    console.log('📄 [13] Content length:', contentLength);

    // ✅ Try to load form-data
    console.log('📦 [14] Loading form-data...');
    let FormData: any;
    try {
      FormData = require('form-data');
      console.log('✅ [15] form-data loaded successfully');
    } catch (err: any) {
      console.error('❌ [15] form-data NOT FOUND:', err.message);
      return res.status(500).json({
        success: false,
        error: 'form-data package not installed. Run: npm install form-data'
      });
    }

    console.log('📤 [16] Starting Quivr upload...');
    
    const QUIVR_API_URL = process.env.NEXT_PUBLIC_QUIVR_API_URL || 'http://34.29.195.158';
    const API_KEY = process.env.QUIVR_API_KEY || '8f3e9d2a7b6c1e4f5a8d9c2b3e6f7a1b4c5d8e9f2a3b6c7d8e9f1a2b3c4d5e6f';
    
    console.log('🌐 [17] API URL:', QUIVR_API_URL);

    const formData = new FormData();
    console.log('✅ [18] FormData created');
    
    const fileName = `${title.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)}.txt`;
    const contentBuffer = Buffer.from(content, 'utf-8');
    
    console.log('📝 [19] Appending fields...');
    formData.append('file', contentBuffer, { filename: fileName, contentType: 'text/plain' });
    formData.append('name', title);
    formData.append('user_address', userAddress);
    formData.append('notebook_id', notebookId);
    formData.append('source_id', sourceId);
    console.log('✅ [20] Fields appended');

    console.log('📤 [21] Sending fetch request...');
    const uploadResponse = await fetch(`${QUIVR_API_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        ...formData.getHeaders(),
      },
      // @ts-ignore
      body: formData,
    });

    console.log('📬 [22] Response received:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ [23] Upload failed:', errorText);
      return res.status(500).json({ success: false, error: errorText.substring(0, 200) });
    }

    console.log('✅ [24] Upload successful');
    const uploadResult = await uploadResponse.json();
    const quivrDocId = uploadResult.doc_id;
    console.log('📄 [25] Doc ID:', quivrDocId);

    // Create and save source
    const source: NotebookSource = {
      id: sourceId,
      title,
      type: 'text',
      status: 'completed',
      progress: 100,
      dateCreated: new Date().toLocaleDateString(),
      fileSize: `${(contentLength / 1024).toFixed(1)} KB`,
      selected: true,
      quivrDocId: quivrDocId,
      fileType: 'text'
    };

    console.log('💾 [26] Updating notebook...');
    const existingSources = notebook.sources || [];
    const existingIndex = existingSources.findIndex((s: NotebookSource) => s.id === sourceId);
    
    if (existingIndex !== -1) {
      existingSources[existingIndex] = source;
    } else {
      existingSources.push(source);
    }

    const updatedNotebook: Notebook = {
      ...notebook,
      sources: existingSources,
      sourceCount: existingSources.length,
      lastUpdated: new Date().toISOString()
    };

    await kv.set(notebookKey, JSON.stringify(updatedNotebook));
    const sourcesKey = `${userKey}:notebook:${notebookId}:sources`;
    await kv.set(sourcesKey, JSON.stringify(existingSources));

    console.log('✅ [27] COMPLETE!');

    res.status(200).json({
      success: true,
      source,
      quivrDocId,
      message: 'Text uploaded successfully'
    });

  } catch (error: any) {
    console.error('❌ [ERROR] At step:', error.message);
    console.error('❌ [ERROR] Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
