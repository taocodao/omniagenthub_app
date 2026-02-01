// pages/api/sources/delete.ts - WITH QUIVR BACKEND INTEGRATION

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const QUIVR_API_URL = process.env.QUIVR_API_URL || 'http://34.29.195.158';
const QUIVR_API_KEY = process.env.QUIVR_API_KEY || '8f3e9d2a7b6c1e4f5a8d9c2b3e6f7a1b4c5d8e9f2a3b6c7d8e9f1a2b3c4d5e6f';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { sourceId, notebookId, userKey, quivrDocId } = req.body;

    // Validate required parameters
    if (!sourceId || !notebookId || !userKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: sourceId, notebookId, userKey'
      });
    }

    console.log('🗑️ Deleting source:', sourceId, 'from notebook:', notebookId);

    // ✅ NEW: Delete from Quivr backend if quivrDocId exists
    let quivrDeleted = false;
    if (quivrDocId) {
      try {
        console.log('🔄 Attempting to delete from Quivr:', quivrDocId);
        const deleteResponse = await fetch(`${QUIVR_API_URL}/documents/${quivrDocId}`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': QUIVR_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (deleteResponse.ok) {
          console.log('✅ Document deleted from Quivr:', quivrDocId);
          quivrDeleted = true;
        } else if (deleteResponse.status === 404) {
          console.log('ℹ️ Document not found in Quivr (404) - continuing:', quivrDocId);
          quivrDeleted = true;
        } else {
          const errorText = await deleteResponse.text();
          console.warn('⚠️ Failed to delete from Quivr:', deleteResponse.status, errorText);
        }
      } catch (quivrError) {
        console.warn('⚠️ Quivr deletion error:', quivrError);
        // Continue with local deletion even if Quivr fails
      }
    } else {
      console.log('ℹ️ No Quivr document ID provided - skipping Quivr deletion');
      quivrDeleted = true;
    }

    // Get current notebook data
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    console.log('📖 Fetching notebook from key:', notebookKey);
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      console.error('❌ Notebook not found at key:', notebookKey);
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }

    // Parse notebook data
    let notebook: any;
    if (typeof notebookData === 'string') {
      try {
        notebook = JSON.parse(notebookData);
      } catch (parseError) {
        console.error('❌ Error parsing notebook data:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse notebook data'
        });
      }
    } else {
      notebook = notebookData;
    }

    // Get current sources
    const currentSources = notebook.sources || [];
    console.log('📋 Current sources count:', currentSources.length);

    // Find source to delete
    const sourceIndex = currentSources.findIndex((source: any) => source.id === sourceId);
    if (sourceIndex === -1) {
      console.log('ℹ️ Source not found in notebook sources:', sourceId);
      return res.status(404).json({
        success: false,
        error: 'Source not found in notebook'
      });
    }

    const sourceToDelete = currentSources[sourceIndex];
    console.log('📋 Found source to delete:', {
      id: sourceToDelete.id,
      title: sourceToDelete.title,
      type: sourceToDelete.type
    });

    // Remove source from array
    const updatedSources = currentSources.filter((source: any) => source.id !== sourceId);
    console.log('🔄 Updated sources count:', updatedSources.length);

    // Update notebook with new sources
    const updatedNotebook = {
      ...notebook,
      sources: updatedSources,
      sourceCount: updatedSources.length,
      lastUpdated: new Date().toISOString()
    };

    // Save updated notebook
    await kv.set(notebookKey, JSON.stringify(updatedNotebook));
    console.log('💾 Updated notebook saved to database');

    // ✅ SUCCESS RESPONSE
    const response = {
      success: true,
      message: 'Source deleted successfully',
      deletedSource: {
        id: sourceToDelete.id,
        title: sourceToDelete.title,
        type: sourceToDelete.type
      },
      quivrDeleted,
      remainingSources: updatedSources.length,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Delete operation completed successfully:', response);
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Delete source error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete source';
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}
