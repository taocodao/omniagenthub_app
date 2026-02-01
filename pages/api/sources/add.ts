// pages/api/sources/add.ts - ENHANCED VERSION WITH EMBEDDING CREATION + GOOGLE DRIVE TRACKING
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface NotebookSource {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text' | 'google-drive'; // ✅ ADD google-drive type
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
  embeddingId?: string;
  fileType?: string;
  embeddingPath?: string;
  // ✅ NEW: Google Drive specific fields
  sourceType?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceMetadata?: any;
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

interface AddSourceRequest {
  userKey: string;
  notebookId: string;
  source: NotebookSource;
  userAddress: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, notebookId, source, userAddress }: AddSourceRequest = req.body;
    
    console.log('➕ Adding source to notebook:', { 
      userKey, 
      notebookId, 
      sourceId: source?.id,
      sourceType: source?.sourceType || source?.type, // ✅ FIXED: Check both fields
      hasContent: !!source?.content,
      hasEmbeddingId: !!source?.embeddingId
    });

    // Validate required fields
    if (!userKey || !notebookId || !source || !userAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userKey, notebookId, source, userAddress'
      });
    }

    if (!source.id || !source.title || !source.type) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source format. Required: id, title, type'
      });
    }

    // ✅ ENHANCED NOTEBOOK LOOKUP WITH DEBUGGING
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    console.log('📖 Fetching notebook at key:', notebookKey);
    
    const notebookData = await kv.get(notebookKey);
    
    if (!notebookData) {
      console.log('❌ Notebook not found:', notebookKey);
      
      // ✅ ENHANCED DEBUGGING: Check alternative keys and user's notebooks
      const userNotebooksKey = `${userKey}:notebooks`;
      const userNotebooks = await kv.get(userNotebooksKey);
      
      console.log('🔍 Debug info:');
      console.log('- userKey:', userKey);
      console.log('- notebookId:', notebookId);
      console.log('- notebookKey:', notebookKey);
      console.log('- userNotebooks:', userNotebooks);
      
      // Check if notebook exists under user's list
      if (Array.isArray(userNotebooks) && userNotebooks.includes(notebookId)) {
        console.log('📋 Notebook ID found in user list but storage key failed');
      } else if (typeof userNotebooks === 'string') {
        try {
          const parsedList = JSON.parse(userNotebooks);
          if (Array.isArray(parsedList) && parsedList.includes(notebookId)) {
            console.log('📋 Notebook ID found in user list (parsed) but storage key failed');
          }
        } catch (e) {
          console.log('📋 Failed to parse user notebooks list');
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Notebook not found',
        debug: {
          userKey,
          notebookId,
          notebookKey,
          userNotebooks,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Parse notebook data
    let notebook: Notebook;
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
      notebook = notebookData as Notebook;
    }

    // ✅ NEW: Create hierarchical embedding if source has content but no embeddingId
    let enhancedSource = { ...source };
    
    if (source.content && !source.embeddingId && userAddress) {
      console.log('🔄 Creating embedding for manually added source...');
      
      try {
        // Create hierarchical embedding ID following the established pattern
        const hierarchicalEmbeddingId = `${userAddress.toLowerCase()}--${notebook.title.replace(/[^a-zA-Z0-9]/g, '_')}--${source.title.replace(/[^a-zA-Z0-9.]/g, '_')}--${source.id}`;
        console.log('🏗️ Generated hierarchical embedding ID:', hierarchicalEmbeddingId.substring(0, 100) + '...');
        
        // Create embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: source.content.substring(0, 8000), // Limit input size for API
            model: 'text-embedding-3-small'
          })
        });

        if (!embeddingResponse.ok) {
          throw new Error(`OpenAI embedding failed: ${embeddingResponse.status} ${await embeddingResponse.text()}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding: number[] = embeddingData.data[0].embedding;
        console.log('✅ OpenAI embedding created, dimensions:', embedding.length);

        // ✅ Store in Pinecone with hierarchical metadata (matches other upload methods)
        const pineconeResponse = await fetch(`https://${process.env.PINECONE_INDEX_NAME}-${process.env.PINECONE_PROJECT_ID}.svc.${process.env.PINECONE_ENVIRONMENT}.pinecone.io/vectors/upsert`, {
          method: 'POST',
          headers: {
            'Api-Key': process.env.PINECONE_API_KEY!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vectors: [{
              id: hierarchicalEmbeddingId,
              values: embedding,
              metadata: {
                sourceId: source.id,
                sourceName: source.title,
                sourceType: source.sourceType || source.type, // ✅ Use sourceType if available
                notebookId,
                notebookName: notebook.title,
                userKey,
                userAddress,
                uploadedAt: new Date().toISOString(),
                content: source.content.substring(0, 2000), // Store preview for debugging
                // ✅ Hierarchical search fields (consistent with other methods)
                userLevel: userAddress.toLowerCase(),
                notebookLevel: `${userAddress.toLowerCase()}--${notebook.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
                sourceLevel: hierarchicalEmbeddingId
              }
            }]
          })
        });

        if (!pineconeResponse.ok) {
          const errorText = await pineconeResponse.text();
          console.warn('⚠️ Pinecone storage failed:', errorText);
          throw new Error(`Pinecone storage failed: ${errorText}`);
        }

        // ✅ SUCCESS: Update source with embedding info
        enhancedSource = {
          ...source,
          embeddingId: hierarchicalEmbeddingId,
          embeddingPath: hierarchicalEmbeddingId,
          status: 'completed' as const,
          progress: 100
        };
        
        console.log('✅ Manual source embedding created successfully:', hierarchicalEmbeddingId.substring(0, 50) + '...');

      } catch (error) {
        console.error('❌ Manual source embedding creation error:', error);
        
        // ✅ Still add source but mark as error if embedding fails
        enhancedSource = {
          ...source,
          status: 'error' as const,
          error: `Embedding creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          progress: 0
        };
      }
    } else if (!source.content && source.type === 'text') {
      // ✅ Handle case where text source has no content
      console.log('⚠️ Text source has no content, cannot create embedding');
      enhancedSource = {
        ...source,
        status: 'error' as const,
        error: 'Text source missing content',
        progress: 0
      };
    } else if (source.embeddingId) {
      // ✅ Source already has embedding, ensure it's marked as completed
      console.log('✅ Source already has embedding:', source.embeddingId.substring(0, 50) + '...');
      enhancedSource = {
        ...source,
        status: 'completed' as const,
        progress: 100
      };
    } else {
      // ✅ FIXED: File or Google Drive sources without content - keep original status
      const displayType = source.sourceType || source.type;
      console.log(`ℹ️ Source type: ${displayType} without content, keeping original status`); // ✅ FIXED TYPO
      enhancedSource = { ...source };
    }

    // Get current sources
    const currentSources: NotebookSource[] = notebook.sources || [];
    console.log('📋 Current sources count:', currentSources.length);

    // Check if source already exists
    const existingSourceIndex = currentSources.findIndex(s => s.id === enhancedSource.id);
    let updatedSources: NotebookSource[];

    if (existingSourceIndex >= 0) {
      // Update existing source
      console.log('🔄 Updating existing source:', enhancedSource.id);
      updatedSources = [...currentSources];
      updatedSources[existingSourceIndex] = { ...updatedSources[existingSourceIndex], ...enhancedSource };
    } else {
      // Add new source
      console.log('➕ Adding new source:', enhancedSource.id);
      updatedSources = [...currentSources, enhancedSource];
    }

    // Update notebook with new sources
    const updatedNotebook: Notebook = {
      ...notebook,
      sources: updatedSources,
      sourceCount: updatedSources.length,
      lastUpdated: new Date().toISOString(),
      userAddress
    };

    // Save updated notebook
    await kv.set(notebookKey, JSON.stringify(updatedNotebook));
    console.log('💾 Notebook updated with', updatedSources.length, 'sources');

    // ✅ ENHANCED SUCCESS RESPONSE WITH GUI STATUS INFO
    const completedWithEmbeddings = updatedSources.filter(s => s.status === 'completed' && s.embeddingId).length;
    const totalCompleted = updatedSources.filter(s => s.status === 'completed').length;

    return res.status(200).json({
      success: true,
      message: existingSourceIndex >= 0 ? 'Source updated successfully' : 'Source added successfully',
      source: enhancedSource,
      notebookId,
      totalSources: updatedSources.length,
      // ✅ GUI Status Information
      chatReady: completedWithEmbeddings > 0,
      sourcesWithEmbeddings: completedWithEmbeddings,
      totalCompletedSources: totalCompleted,
      embeddingCreated: !!enhancedSource.embeddingId && enhancedSource.embeddingId !== source.embeddingId,
      debug: {
        userKey,
        notebookId,
        notebookKey,
        sourceId: enhancedSource.id,
        sourceType: enhancedSource.sourceType || enhancedSource.type,
        sourceStatus: enhancedSource.status,
        hasEmbedding: !!enhancedSource.embeddingId,
        embeddingId: enhancedSource.embeddingId?.substring(0, 50) + '...',
        action: existingSourceIndex >= 0 ? 'updated' : 'added',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error adding source to notebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
