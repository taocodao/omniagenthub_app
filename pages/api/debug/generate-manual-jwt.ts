// pages/api/debug/generate-manual-jwt.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';

const SURFSENSE_API_URL = process.env.SURFSENSE_API_URL || 'https://surfsense-backend-730233624615.us-central1.run.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Common secret keys that might be used in SurfSense
    const possibleKeys = [
      // Default FastAPI-Users keys
      'your-secret-key-here-make-it-random',
      'surfsense-secret-key',
      'fastapi-secret-key',
      'secret-key',
      'SECRET',
      // More secure defaults
      'change-this-to-a-real-secret-key',
      'insecure-secret-for-testing-only',
      // Based on your YAML (if exposed)
      'surfsense-secret-key-2024'
    ];

    const payload = {
      sub: 'admin-user-generated',
      aud: ['fastapi-users:auth'],
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      iat: Math.floor(Date.now() / 1000)
    };

    const results = [];

    console.log('🔐 Testing JWT tokens with different secret keys...');

    for (const secretKey of possibleKeys) {
      try {
        // Generate token with this secret key
        const token = jwt.sign(payload, secretKey, { algorithm: 'HS256' });
        
        console.log(`Testing key: ${secretKey.substring(0, 15)}...`);

        // Test the token immediately against SurfSense
        const testResponse = await axios.get(
          `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            timeout: 10000,
            validateStatus: () => true // Accept any status
          }
        );

        const works = testResponse.status === 200;

        results.push({
          secretKey: secretKey.substring(0, 20) + (secretKey.length > 20 ? '...' : ''),
          tokenPreview: token.substring(0, 30) + '...',
          testStatus: testResponse.status,
          works: works,
          fullToken: works ? token : null,
          errorDetail: testResponse.status !== 200 ? testResponse.data : null
        });

        if (works) {
          console.log(`✅ SUCCESS with key: ${secretKey.substring(0, 15)}...`);
          break; // Stop testing once we find a working key
        }

      } catch (error: any) {
        console.error(`❌ Error with key ${secretKey.substring(0, 15)}:`, error.message);
        results.push({
          secretKey: secretKey.substring(0, 20) + '...',
          error: error.message,
          works: false
        });
      }
    }

    const workingResult = results.find(r => r.works);

    res.json({
      success: true,
      tested: results.length,
      results: results,
      workingToken: workingResult?.fullToken || null,
      workingSecretKey: workingResult ? workingResult.secretKey : null,
      summary: {
        hasWorkingToken: !!workingResult,
        instruction: workingResult 
          ? '✅ SUCCESS! Update your .env.local with the workingToken below.'
          : '❌ No working token found. Try AUTH_TYPE=NONE instead or check backend SECRET_KEY.'
      }
    });

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
