// pages/api/sources/upload-text.ts - FINAL FIX: NO NOTEBOOK CREATION OR UPDATE
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userKey, sourceId, notebookId, title, content, userAddress } = req.body;

    console.log('📝 [Upload] Text:', title, 'for user:', userAddress?.substring(0, 10) + '...');

    if (!userKey || !sourceId || !notebookId || !title || !content || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // ✅ DON'T check if notebook exists - add.ts will handle that!
    // Just upload to Quivr and return the doc ID

    const contentLength = content.length;
    console.log('📤 [Quivr] Starting upload...');

    // Upload to Quivr
    let quivrDocId = null;
    const QUIVR_API_URL = process.env.NEXT_PUBLIC_QUIVR_API_URL || 'http://34.29.195.158';
    const API_KEY = process.env.QUIVR_API_KEY || '8f3e9d2a7b6c1e4f5a8d9c2b3e6f7a1b4c5d8e9f2a3b6c7d8e9f1a2b3c4d5e6f';
    
    try {
      const FormData = require('form-data');
      const formData = new FormData();
      
      const fileName = `${title.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)}.txt`;
      const contentBuffer = Buffer.from(content, 'utf-8');
      
      formData.append('file', contentBuffer, {
        filename: fileName,
        contentType: 'text/plain',
      });
      formData.append('name', title);
      formData.append('user_address', userAddress);
      formData.append('notebook_id', notebookId);
      formData.append('source_id', sourceId);

      console.log('📋 [Quivr] Uploading:', fileName);

      const uploadResponse = await fetch(`${QUIVR_API_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          ...formData.getHeaders(),
        },
        body: formData.getBuffer(),
      });

      console.log('📬 [Quivr] Response:', uploadResponse.status);

      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        quivrDocId = uploadResult.doc_id;
        console.log('✅ [Quivr] Success! Doc ID:', quivrDocId);
      } else {
        const errorText = await uploadResponse.text();
        console.error('❌ [Quivr] Failed:', errorText.substring(0, 500));
        
        return res.status(500).json({
          success: false,
          error: `Quivr upload failed: ${errorText.substring(0, 200)}`
        });
      }
      
    } catch (quivrError: any) {
      console.error('❌ [Quivr] Error:', quivrError.message);
      return res.status(500).json({
        success: false,
        error: `Quivr upload error: ${quivrError.message}`
      });
    }

    if (!quivrDocId) {
      return res.status(500).json({
        success: false,
        error: 'No document ID returned'
      });
    }

    // ✅ CRITICAL: NO NOTEBOOK OPERATIONS HERE!
    // Just return success - add.ts will handle everything
    console.log('✅ [Upload] Complete! (add.ts will handle notebook update)');

    res.status(200).json({
      success: true,
      quivrDocId,
      message: 'Text uploaded successfully',
      contentLength: contentLength,
      sourceId: sourceId
    });

  } catch (error: any) {
    console.error('❌ [Upload] Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload text'
    });
  }
}
