// pages/api/notebooks/update-embeddings.ts - COMPLETE FIX WITH ASSISTANT CREATION
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface UpdateEmbeddingsRequest {
  userKey: string;
  notebookId: string;
  userAddress?: string;
  createAssistant?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userKey, notebookId, createAssistant } = req.body as UpdateEmbeddingsRequest;

    if (!userKey || !notebookId) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
    }

    console.log('🔄 Updating embeddings for notebook:', notebookId);

    // Get notebook
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);
    
    if (!notebookData || typeof notebookData !== 'string') {
      return res.status(404).json({ success: false, message: 'Notebook not found.' });
    }

    const notebook = JSON.parse(notebookData);
    console.log('📖 Found notebook:', notebook.title);

    // Get sources directly from notebook (they're stored there now)
    const sources = notebook.sources || [];
    console.log('📋 Total sources in notebook:', sources.length);

    // Get all Pinecone file IDs from completed sources
    const completedSources = sources.filter((source: any) => 
      source.status === 'completed' && source.pineconeFileId
    );
    
    console.log('✅ Completed sources with Pinecone files:', completedSources.length);

    const pineconeFileIds = completedSources.map((source: any) => source.pineconeFileId);

    if (pineconeFileIds.length === 0) {
      console.log('⚠️ No Pinecone files to process');
      return res.status(200).json({ 
        success: true, 
        message: "No sources with Pinecone files found", 
        assistantId: notebook.pineconeAssistantId || null,
        sourceCount: 0
      });
    }

    console.log('📁 Pinecone file IDs to process:', pineconeFileIds);

    // ✅ CRITICAL FIX: Create assistant if it doesn't exist
    let assistantId = notebook.pineconeAssistantId;
    let assistantName = notebook.pineconeAssistantName;

    if (!assistantId || createAssistant) {
      console.log('🤖 Creating new Pinecone assistant...');
      
      try {
        const assistantResponse = await fetch('https://api.pinecone.io/assistant/assistants', {
          method: 'POST',
          headers: {
            'Api-Key': process.env.PINECONE_API_KEY!,
            'X-Pinecone-API-Version': '2025-10',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `${notebook.title} Assistant`,
            instructions: `You are a helpful assistant that answers questions based on the uploaded documents. You have access to ${completedSources.length} sources that the user has uploaded. Always provide accurate, helpful responses based on the available information.`,
            model: 'gpt-4',
            tools: [{ type: 'file_search' }]
          })
        });

        if (!assistantResponse.ok) {
          const errorText = await assistantResponse.text();
          throw new Error(`Assistant creation failed: ${errorText}`);
        }

        const assistantData = await assistantResponse.json();
        assistantId = assistantData.id;
        assistantName = assistantData.name;
        
        console.log('✅ Created assistant:', {
          id: assistantId,
          name: assistantName
        });

      } catch (error) {
        console.error('❌ Error creating assistant:', error);
        throw error;
      }
    }

    // Create or update vector store for the assistant
    console.log('🔄 Creating/updating vector store...');
    
    try {
      // Create vector store with files
      const vectorStoreResponse = await fetch('https://api.pinecone.io/assistant/vector_stores', {
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY!,
          'X-Pinecone-API-Version': '2025-10',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${notebook.title} - Embeddings`,
          file_ids: pineconeFileIds
        })
      });

      if (!vectorStoreResponse.ok) {
        const errorText = await vectorStoreResponse.text();
        throw new Error(`Vector store creation failed: ${errorText}`);
      }

      const vectorStoreData = await vectorStoreResponse.json();
      console.log('✅ Created vector store:', vectorStoreData.id);

      // Update assistant with vector store
      console.log('🔄 Attaching vector store to assistant...');
      
      const updateAssistantResponse = await fetch(`https://api.pinecone.io/assistant/assistants/${assistantId}`, {
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY!,
          'X-Pinecone-API-Version': '2025-10',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStoreData.id]
            }
          }
        })
      });

      if (!updateAssistantResponse.ok) {
        const errorText = await updateAssistantResponse.text();
        console.warn('⚠️ Failed to attach vector store to assistant:', errorText);
        // Continue anyway - the assistant was created
      } else {
        console.log('✅ Successfully attached vector store to assistant');
      }

      // Update notebook with assistant and vector store info
      const updatedNotebook = {
        ...notebook,
        pineconeAssistantId: assistantId,
        pineconeAssistantName: assistantName,
        vectorStoreId: vectorStoreData.id,
        lastUpdated: new Date().toISOString(),
        sourceCount: completedSources.length
      };

      await kv.set(notebookKey, JSON.stringify(updatedNotebook));
      console.log('💾 Updated notebook with assistant info');

      return res.status(200).json({ 
        success: true, 
        message: 'Chat assistant created successfully!', 
        assistantId,
        assistantName,
        vectorStoreId: vectorStoreData.id,
        sourceCount: completedSources.length
      });

    } catch (error) {
      console.error('❌ Error creating vector store:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error updating embeddings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ 
      success: false, 
      message: `Failed to create chat assistant: ${errorMessage}` 
    });
  }
}
