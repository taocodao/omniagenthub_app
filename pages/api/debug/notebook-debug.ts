// pages/api/debug/notebook-debug.ts - COMPREHENSIVE NOTEBOOK DIAGNOSTIC
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, action } = req.query;

    if (!userKey || typeof userKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'userKey parameter is required'
      });
    }

    const timestamp = new Date().toISOString();
    console.log('🔍 Notebook diagnostic for userKey:', userKey, 'at', timestamp);

    const diagnostic = {
      userKey,
      timestamp,
      notebooksListKey: `${userKey}:notebooks`,
      notebooksListData: null as any,
      notebooksListType: null as string | null,
      parsedNotebookIds: [] as string[],
      individualNotebooks: [] as any[],
      issues: [] as string[],
      recommendations: [] as string[],
      environment: {
        KV_REST_API_URL: !!process.env.KV_REST_API_URL,
        KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
        PINECONE_API_KEY: !!process.env.PINECONE_API_KEY
      }
    };

    // Check notebook list
    try {
      const notebooksKey = `${userKey}:notebooks`;
      const notebookIds = await kv.get(notebooksKey);

      diagnostic.notebooksListData = notebookIds;
      diagnostic.notebooksListType = typeof notebookIds;

      console.log('Raw notebooks list data:', notebookIds);
      console.log('Raw notebooks list type:', typeof notebookIds);

      // Parse notebook IDs
      if (notebookIds) {
        if (typeof notebookIds === 'string') {
          try {
            diagnostic.parsedNotebookIds = JSON.parse(notebookIds);
          } catch (e) {
            diagnostic.issues.push(`Failed to parse notebooks list JSON: ${e}`);
          }
        } else if (Array.isArray(notebookIds)) {
          diagnostic.parsedNotebookIds = notebookIds;
        } else {
          diagnostic.issues.push(`Unexpected notebooks list type: ${typeof notebookIds}`);
        }
      }

      // Check individual notebooks
      for (const notebookId of diagnostic.parsedNotebookIds) {
        const notebookKey = `${userKey}:notebook:${notebookId}`;
        const notebookData = await kv.get(notebookKey);

        const notebookInfo = {
          id: notebookId,
          key: notebookKey,
          exists: !!notebookData,
          type: typeof notebookData,
          size: notebookData ? JSON.stringify(notebookData).length : 0,
          preview: null as any,
          issues: [] as string[]
        };

        if (notebookData) {
          try {
            let parsed;
            if (typeof notebookData === 'string') {
              parsed = JSON.parse(notebookData);
            } else {
              parsed = notebookData;
            }

            notebookInfo.preview = {
              id: parsed.id,
              title: parsed.title,
              sourceCount: parsed.sourceCount || 0,
              actualSourcesLength: Array.isArray(parsed.sources) ? parsed.sources.length : 'N/A',
              created: parsed.created,
              userAddress: parsed.userAddress,
              pineconeAssistantName: parsed.pineconeAssistantName
            };

            // Check for data integrity issues
            if (!parsed.id) notebookInfo.issues.push('Missing id field');
            if (!parsed.title) notebookInfo.issues.push('Missing title field');
            if (!parsed.sources) notebookInfo.issues.push('Missing sources field');
            if (!Array.isArray(parsed.sources)) notebookInfo.issues.push('Sources is not an array');
            if (parsed.sourceCount !== (Array.isArray(parsed.sources) ? parsed.sources.length : 0)) {
              notebookInfo.issues.push('sourceCount mismatch with sources array length');
            }

          } catch (e) {
            notebookInfo.issues.push(`Failed to parse notebook data: ${e}`);
            diagnostic.issues.push(`Failed to parse notebook ${notebookId}: ${e}`);
          }
        } else {
          notebookInfo.issues.push('Notebook exists in list but data not found');
          diagnostic.issues.push(`Notebook ${notebookId} exists in list but data not found`);
        }

        diagnostic.individualNotebooks.push(notebookInfo);
      }

    } catch (error) {
      diagnostic.issues.push(`Error during diagnostic: ${error}`);
    }

    // Generate recommendations
    if (diagnostic.issues.length === 0) {
      diagnostic.recommendations.push('✅ All notebook data looks healthy');
    } else {
      diagnostic.recommendations.push('🔧 Issues found with notebook data:');
      diagnostic.issues.forEach(issue => {
        diagnostic.recommendations.push(`   • ${issue}`);
      });
    }

    if (diagnostic.parsedNotebookIds.length === 0) {
      diagnostic.recommendations.push('📝 User has no notebooks - this is normal for new users');
      diagnostic.recommendations.push('💡 Create a test notebook to initialize the system');
    } else {
      diagnostic.recommendations.push(`📊 Found ${diagnostic.parsedNotebookIds.length} notebook(s) in storage`);
    }

    // Environment recommendations
    if (!diagnostic.environment.KV_REST_API_URL || !diagnostic.environment.KV_REST_API_TOKEN) {
      diagnostic.recommendations.push('❌ KV storage not properly configured');
    } else {
      diagnostic.recommendations.push('✅ KV storage is properly configured');
    }

    // Action: Fix data if requested
    if (action === 'fix' && diagnostic.individualNotebooks.some(nb => nb.issues.length > 0)) {
      diagnostic.recommendations.push('🔧 Running auto-fix for data integrity issues...');

      for (const notebookInfo of diagnostic.individualNotebooks) {
        if (notebookInfo.issues.length > 0 && notebookInfo.exists) {
          try {
            const notebookData = await kv.get(notebookInfo.key);
            if (notebookData) {
              let notebook;
              if (typeof notebookData === 'string') {
                notebook = JSON.parse(notebookData);
              } else {
                notebook = notebookData;
              }

              // Fix common issues
              if (!notebook.id) notebook.id = notebookInfo.id;
              if (!notebook.title) notebook.title = 'Untitled Notebook';
              if (!notebook.sources) notebook.sources = [];
              if (!Array.isArray(notebook.sources)) notebook.sources = [];
              if (!notebook.created) notebook.created = 'Unknown';
              if (!notebook.lastUpdated) notebook.lastUpdated = new Date().toISOString();

              // Fix source count
              notebook.sourceCount = notebook.sources.length;

              // Save fixed notebook
              await kv.set(notebookInfo.key, JSON.stringify(notebook));
              diagnostic.recommendations.push(`✅ Fixed issues in notebook: ${notebookInfo.id}`);
            }
          } catch (error) {
            diagnostic.recommendations.push(`❌ Failed to fix notebook ${notebookInfo.id}: ${error}`);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      diagnostic
    });

  } catch (error) {
    console.error('Diagnostic error:', error);
    return res.status(500).json({
      success: false,
      message: 'Diagnostic failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
