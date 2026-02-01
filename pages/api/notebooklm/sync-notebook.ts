// pages/api/notebooklm/sync-notebook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import NotebookLMMCP from '../../../lib/notebooklm-mcp';
import { PineconeService } from '../../../lib/pinecone-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { notebookId, notebookTitle } = req.body;

  if (!notebookId || !notebookTitle) {
    return res.status(400).json({ 
      success: false, 
      error: 'notebookId and notebookTitle are required' 
    });
  }

  try {
    const tokenCookie = req.cookies.notebooklm_tokens;

    if (!tokenCookie) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const tokens = JSON.parse(tokenCookie);

    // Set up Server-Sent Events for progress updates
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (stage: string, progress: number, message: string, totalVectors?: number) => {
      const data = {
        type: 'progress',
        progress: { stage, progress, message, totalVectors }
      };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sendResult = (result: any) => {
      const data = { type: 'result', result };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sendError = (error: string) => {
      const data = { type: 'error', error };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let mcp: NotebookLMMCP | null = null;
    let pinecone: PineconeService | null = null;

    try {
      sendProgress('initializing', 5, 'Connecting to NotebookLM...');

      // Initialize MCP connection
      mcp = new NotebookLMMCP();
      const connected = await mcp.connect();

      if (!connected) {
        throw new Error('Failed to connect to NotebookLM MCP server');
      }

      sendProgress('authenticating', 10, 'Authenticating with Google...');
      await mcp.authenticate(tokens);

      sendProgress('extracting', 20, 'Extracting notebook content...');
      const content = await mcp.extractNotebookContent(notebookId);

      if (!content || content.length === 0) {
        throw new Error('No content found in notebook');
      }

      sendProgress('processing', 40, `Processing ${content.length} content items...`);

      // Initialize Pinecone
      pinecone = new PineconeService();
      await pinecone.initialize();

      sendProgress('chunking', 50, 'Creating content chunks...');
      const chunks = await pinecone.chunkContent(content, notebookTitle);

      sendProgress('embedding', 60, 'Generating embeddings...');
      const vectors = await pinecone.generateEmbeddings(chunks, notebookId, notebookTitle);

      sendProgress('storing', 80, `Storing ${vectors.length} vectors in Pinecone...`);
      await pinecone.upsertVectors(vectors);

      sendProgress('completing', 100, 'Sync completed successfully!', vectors.length);

      const result = {
        success: true,
        notebook: notebookTitle,
        vectorsCreated: vectors.length,
        pineconeIndex: process.env.PINECONE_INDEX_NAME || 'web3aistore',
        knowledgeBaseName: notebookTitle
      };

      sendResult(result);

    } catch (error) {
      console.error('Sync error:', error);
      sendError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      if (mcp) {
        mcp.disconnect();
      }
      res.end();
    }

  } catch (error) {
    console.error('Sync notebook API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
