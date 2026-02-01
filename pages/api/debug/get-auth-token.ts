// pages/api/debug/get-auth-token.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const SURFSENSE_API_URL = process.env.SURFSENSE_API_URL!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Try to get a fresh auth token
    // This depends on your SurfSense setup - usually there's a /login or /auth endpoint
    
    // Option 1: Try login endpoint
    const loginResponse = await axios.post(
      `${SURFSENSE_API_URL}/api/v1/auth/login`,
      {
        username: 'admin', // Use your SurfSense username
        password: 'admin'  // Use your SurfSense password
      }
    );

    res.json({
      success: true,
      token: loginResponse.data.access_token || loginResponse.data.token,
      expires: loginResponse.data.expires_in
    });

  } catch (error: any) {
    // Try different auth endpoints
    console.error('Auth error:', error.response?.data);
    
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      suggestion: 'Try different auth endpoints or check SurfSense auth configuration'
    });
  }
}
