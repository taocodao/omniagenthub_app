// pages/api/notebooks/chat.ts - WORKING VERSION FOR QUIVR v2.4
// ═══════════════════════════════════════════════════════════════════════════════
// FIXED: Use application/x-www-form-urlencoded with source_ids as JSON string
// Based on OpenAPI spec: source_ids is type "string" with default "[]"
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import axios, { AxiosError } from 'axios';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const QUIVR_API_URL = process.env.QUIVR_API_URL || 'http://34.29.195.158';
const QUIVR_API_KEY = process.env.QUIVR_API_KEY || '8f3e9d2a7b6c1e4f5a8d9c2b3e6f7a1b4c5d8e9f2a3b6c7d8e9f1a2b3c4d5e6f';

interface NotebookSource {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  dateCreated: string;
  selected: boolean;
  quivrDocId?: string;
  fileName?: string;
  fileType?: string;
  content?: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourcesUsed?: string[];
  rewrittenQuery?: string;
}

interface ChatRequest {
  userKey: string;
  notebookId: string;
  query: string;
  selectedSources?: string[];
  sources?: NotebookSource[];
  userAddress: string;
  conversationHistory?: ConversationMessage[];
}

interface ChatResponse {
  success: boolean;
  response?: string;
  sourcesUsed?: string[];
  messageId?: string;
  timestamp?: string;
  message?: string;
  rewrittenQuery?: string;
  sessionId?: string;
}

interface QuivrV24ChatResponse {
  response: string;
  rewritten_query?: string;
  sources: string[];
  chunks_found?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    const {
      userKey,
      notebookId,
      query,
      selectedSources = [],
      sources: sourcesFromRequest = [],
      conversationHistory = [],
      userAddress,
    } = req.body as ChatRequest;

    if (!userKey || !query?.trim() || !notebookId || !userAddress) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: userKey, query, notebookId, userAddress',
      });
      return;
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💬 [Chat] v2.4 query:', query);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 Selected sources:', selectedSources);
    console.log('👤 User address:', userAddress);
    console.log('📖 Notebook ID:', notebookId);
    console.log('📜 Conversation history:', conversationHistory.length, 'messages');
    console.log('═══════════════════════════════════════════════════════════════');

    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      res.status(404).json({
        success: false,
        message: 'Notebook not found',
      });
      return;
    }

    const selectedSourceIds: string[] = [];
    const selectedDocNames: string[] = [];
    
    if (selectedSources.length > 0) {
      console.log('🔍 Processing sources for v2.4...');
      
      for (const source of sourcesFromRequest) {
        if (selectedSources.includes(source.id)) {
          selectedDocNames.push(source.title);
          selectedSourceIds.push(source.id);
          console.log(`✅ Source: ${source.title} -> ${source.id}`);
        }
      }
    }

    if (selectedSourceIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No sources selected. Please select at least one source.',
      });
      return;
    }

    console.log('📊 Chat Summary:');
    console.log('   User:', userAddress.substring(0, 10) + '...');
    console.log('   Notebook:', notebookId);
    console.log('   Source IDs:', selectedSourceIds);
    console.log('   Source Names:', selectedDocNames);
    console.log('═══════════════════════════════════════════════════════════════');

    let responseText = '';
    let sourcesUsed: string[] = [];
    let rewrittenQuery: string | undefined;
    const sessionId = `${userAddress}_${notebookId}`;

    try {
      console.log('🚀 Calling Quivr v2.4 /chat...');
      
      // ✅ CORRECT: Use URLSearchParams with source_ids as JSON string
      const params = new URLSearchParams();
      params.append('query', query);
      params.append('user_address', userAddress);
      params.append('notebook_id', notebookId);
      params.append('source_ids', JSON.stringify(selectedSourceIds)); // ✅ Stringify array!
      params.append('top_k', '5');

      console.log('📡 Request Details:');
      console.log('   URL:', `${QUIVR_API_URL}/chat`);
      console.log('   Content-Type: application/x-www-form-urlencoded');
      console.log('   Body:', params.toString());

      const chatResponse = await axios.post<QuivrV24ChatResponse>(
        `${QUIVR_API_URL}/chat`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-Key': QUIVR_API_KEY,
          },
          timeout: 60000,
        }
      );

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✅ [Chat] v2.4 response received');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📝 Response length:', chatResponse.data.response?.length || 0, 'chars');
      console.log('🔄 Rewritten query:', chatResponse.data.rewritten_query || 'None');
      console.log('📚 Sources:', chatResponse.data.sources?.join(', ') || 'None');
      console.log('🧩 Chunks found:', chatResponse.data.chunks_found || 0);
      console.log('═══════════════════════════════════════════════════════════════');

      if (chatResponse.data && chatResponse.data.response) {
        responseText = chatResponse.data.response;
        rewrittenQuery = chatResponse.data.rewritten_query;
        sourcesUsed = chatResponse.data.sources || selectedDocNames;

        console.log('✅ RAG response generated successfully');
        console.log('   Query rewriting:', rewrittenQuery ? 'Yes' : 'No');
        console.log('   Sources used:', sourcesUsed.join(', '));
      } else {
        responseText = "I couldn't find relevant information in your selected documents.";
        sourcesUsed = selectedDocNames;
        console.log('⚠️ No response content in API response');
      }

    } catch (quivrError) {
      const error = quivrError as AxiosError<{ detail?: any }>;
      
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('❌ Quivr v2.4 API Error');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      
      if (error.response?.data?.detail) {
        console.error('Backend Detail:', JSON.stringify(error.response.data.detail, null, 2));
      }
      console.error('═══════════════════════════════════════════════════════════════');
      
      if (error.response?.status === 422 || error.response?.status === 500) {
        responseText = 'Configuration error. Please try reloading the page.';
      } else if (error.response?.status === 401) {
        responseText = 'Authentication failed. Please check API configuration.';
      } else if (error.response?.status === 404) {
        responseText = 'No documents found. Please upload files first.';
      } else if (error.response?.status === 503) {
        responseText = 'Service unavailable. Please try again in a moment.';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        responseText = 'Request timed out. Please try a simpler query.';
      } else if (error.code === 'ECONNREFUSED') {
        responseText = 'Cannot connect to RAG service. Please check service status.';
      } else {
        responseText = 'Sorry, I encountered an error. Please try again.';
      }
    }

    try {
      const conversationKey = `chat:${userKey}:${notebookId}`;
      const messageId = `msg_${Date.now()}`;
      
      const updatedHistory: ConversationMessage[] = [
        ...conversationHistory.slice(-10),
        {
          id: `${messageId}_user`,
          role: 'user',
          content: query,
          timestamp: new Date().toISOString(),
          rewrittenQuery: rewrittenQuery,
        },
        {
          id: `${messageId}_assistant`,
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
          sourcesUsed: sourcesUsed.length > 0 ? sourcesUsed : selectedDocNames,
        },
      ];

      await kv.set(conversationKey, JSON.stringify(updatedHistory), { ex: 86400 });
      
      console.log('✅ Conversation saved to KV');
      console.log('   Session ID:', sessionId);
      console.log('   Total messages:', updatedHistory.length);
      console.log('═══════════════════════════════════════════════════════════════');
    } catch (kvError) {
      console.error('⚠️ Failed to store conversation:', kvError);
    }

    res.status(200).json({
      success: true,
      response: responseText,
      sourcesUsed: sourcesUsed.length > 0 ? sourcesUsed : selectedDocNames,
      messageId: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
      rewrittenQuery: rewrittenQuery,
      sessionId: sessionId,
    });

  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('❌ [Chat] Fatal Error');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('Error:', error);
    console.error('═══════════════════════════════════════════════════════════════');
    
    res.status(500).json({
      success: false,
      message: `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
