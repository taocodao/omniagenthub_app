// pages/api/notebooklm/auth-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const tokenCookie = req.cookies.notebooklm_tokens;

    if (!tokenCookie) {
      return res.status(200).json({ success: false, error: 'Not authenticated' });
    }

    const tokens = JSON.parse(tokenCookie);

    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      return res.status(200).json({ success: false, error: 'Token expired' });
    }

    res.status(200).json({ 
      success: true, 
      userEmail: tokens.user_info?.email || 'Unknown',
      userName: tokens.user_info?.name || 'Unknown User'
    });

  } catch (error) {
    console.error('Auth status error:', error);
    res.status(200).json({ success: false, error: 'Invalid authentication data' });
  }
}
