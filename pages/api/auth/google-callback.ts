// pages/api/auth/google-callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

// Configure OAuth2Client for your custom GCP Google authentication
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  // Updated redirect URI to match new route
  `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/google-callback`
);

/**
 * Custom Google OAuth callback handler
 * Separate from Auth0 to avoid conflicts
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const { code, error, state } = req.query;

  console.log('=== Custom GCP Google OAuth Callback ===');
  console.log('Code:', code ? 'Present' : 'Missing');
  console.log('State:', state);

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error from Google:', error);
    return res.redirect('/auth/error?error=' + encodeURIComponent(error as string));
  }

  // Validate authorization code
  if (!code) {
    console.error('No authorization code received');
    return res.redirect('/auth/error?error=missing_code');
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    console.log('✅ Token exchange successful');

    // Fetch user information from Google
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const user = userInfoResponse.data;

    console.log('✅ User info retrieved:', user.email);

    // Create session data
    const sessionData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      user_info: user,
      created_at: Date.now(),
    };

    // Encode session data as base64
    const cookieValue = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    // Set secure httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `notebooklm_auth=${cookieValue}; HttpOnly; Path=/; Max-Age=3600; SameSite=Strict; Secure=${isProduction}`,
    ]);

    console.log('✅ Session cookie created');

    // Redirect to success page
    res.redirect('/auth/success');
  } catch (error) {
    console.error('Custom GCP OAuth callback error:', error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    res.redirect('/auth/error?error=callback_failed');
  }
}
