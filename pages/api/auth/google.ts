// pages/api/auth/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { handleCallback } from '@auth0/nextjs-auth0';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback`
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ============================================
  // DETECT IF THIS IS AUTH0 OR CUSTOM GCP OAUTH
  // ============================================
  const state = req.query.state as string;
  const { code, error } = req.query;

  // Enhanced Auth0 detection logic
  // Check multiple indicators to accurately detect Auth0
  const isAuth0Callback = !!(
    // 1. Check for Auth0-specific state patterns
    (state && (
      state.includes('g6Fo2SA') ||           // Auth0 state prefix pattern 1
      state.includes('hKFo2SA') ||           // Auth0 state prefix pattern 2
      state.length > 50                       // Auth0 states are typically 50+ chars (yours is 55)
    )) ||
    // 2. Check for Auth0-specific query parameters
    req.query.connection ||                   // Auth0 includes connection parameter
    // 3. Check if coming from Auth0 domain
    req.headers.referer?.includes('auth0.com')
  );

  // Add detailed logging for debugging
  console.log('==========================================');
  console.log('CALLBACK DETECTION:');
  console.log('State:', state);
  console.log('State length:', state?.length);
  console.log('Has connection param:', !!req.query.connection);
  console.log('Referer:', req.headers.referer);
  console.log('Decision: Using', isAuth0Callback ? 'AUTH0' : 'CUSTOM GCP', 'handler');
  console.log('==========================================');

  // Route to Auth0 handler if detected
  if (isAuth0Callback) {
    console.log('✅ Auth0 callback detected - routing to Auth0 handler');

    try {
      return await handleCallback(req, res);
    } catch (authError) {
      console.error('Auth0 callback error:', authError);
      return res.redirect('/signin?error=auth0_callback_failed');
    }
  }

  // ============================================
  // CUSTOM GCP GOOGLE OAUTH LOGIC (YOUR EXISTING CODE)
  // ============================================
  console.log('✅ Custom GCP Google OAuth callback detected');

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect('/auth/error?error=' + encodeURIComponent(error as string));
  }

  if (!code) {
    return res.redirect('/auth/error?error=missing_code');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const user = userInfoResponse.data;

    // Create session data
    const sessionData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      user_info: user,
      created_at: Date.now()
    };

    // Set secure httpOnly cookie
    const cookieValue = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    res.setHeader('Set-Cookie', [
      `notebooklm_auth=${cookieValue}; HttpOnly; Path=/; Max-Age=3600; SameSite=Strict; Secure=${process.env.NODE_ENV === 'production'}`,
    ]);

    // Redirect to success page
    res.redirect('/auth/success');
  } catch (error) {
    console.error('Custom GCP OAuth callback error:', error);
    res.redirect('/auth/error?error=callback_failed');
  }
}
