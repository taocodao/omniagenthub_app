// pages/api/notebooklm/notebooks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import NotebookLMMCP from '../../../lib/notebooklm-mcp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const tokenCookie = req.cookies.notebooklm_tokens;

    if (!tokenCookie) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const tokens = JSON.parse(tokenCookie);

    // Initialize MCP connection
    const mcp = new NotebookLMMCP();

    try {
      const connected = await mcp.connect();

      if (!connected) {
        throw new Error('Failed to connect to NotebookLM MCP server');
      }

      // Authenticate with NotebookLM
      await mcp.authenticate(tokens);

      // Get notebooks
      const notebooks = await mcp.getNotebooks();

      res.status(200).json({ 
        success: true, 
        notebooks: notebooks,
        count: notebooks.length 
      });

    } finally {
      mcp.disconnect();
    }

  } catch (error) {
    console.error('Notebooks API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to load notebooks'
    });
  }
}
