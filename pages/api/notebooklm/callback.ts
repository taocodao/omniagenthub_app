// pages/api/notebooklm/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/notebooklm/callback'
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    return res.redirect('/notebooklm-sync?error=auth_failed');
  }

  if (!code) {
    return res.redirect('/notebooklm-sync?error=no_code');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store tokens in secure HTTP-only cookie using Next.js built-in method
    const tokenData = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      user_info: userInfo.data
    });

    // Set cookie using Next.js response methods
    res.setHeader('Set-Cookie', [
      `notebooklm_tokens=${encodeURIComponent(tokenData)}; HttpOnly; Path=/; Max-Age=3600; SameSite=Lax${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }`
    ]);

    res.redirect('/notebooklm-sync?success=true');

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/notebooklm-sync?error=callback_failed');
  }
}
