// pages/api/debug/create-local-auth.ts - Test LOCAL auth (FIXED)
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const SURFSENSE_API_URL = process.env.SURFSENSE_API_URL || 'https://surfsense-backend-730233624615.us-central1.run.app';

interface Summary {
  canRegister: boolean;
  canLogin: boolean;
  tokenWorks: boolean;
  hasWorkingAuth: boolean;
  instruction: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Try registration
  try {
    console.log('🔧 Attempting registration...');
    const registerResponse = await axios.post(
      `${SURFSENSE_API_URL}/api/v1/auth/register`,
      {
        email: 'admin@example.com',
        password: 'admin123',
        is_active: true,
        is_superuser: true,
        is_verified: true
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    results.tests.register = {
      success: registerResponse.status === 201,
      status: registerResponse.status,
      data: registerResponse.data,
      userCreated: registerResponse.status === 201
    };

  } catch (error: any) {
    results.tests.register = {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }

  // Test 2: Try login (whether registration worked or not)
  try {
    console.log('🔐 Attempting login...');
    const loginResponse = await axios.post(
      `${SURFSENSE_API_URL}/api/v1/auth/jwt/login`,
      new URLSearchParams({
        username: 'admin@example.com',
        password: 'admin123'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    results.tests.login = {
      success: loginResponse.status === 200,
      status: loginResponse.status,
      data: loginResponse.data,
      hasToken: !!loginResponse.data?.access_token
    };

    if (loginResponse.data?.access_token) {
      // Test 3: Try using the token
      console.log('🧪 Testing new token...');
      const testResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
        {
          headers: {
            'Authorization': `Bearer ${loginResponse.data.access_token}`
          },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      results.tests.tokenTest = {
        success: testResponse.status === 200,
        status: testResponse.status,
        data: testResponse.data,
        searchSpaceCount: Array.isArray(testResponse.data) ? testResponse.data.length : 0
      };

      if (testResponse.status === 200) {
        results.newJwtToken = loginResponse.data.access_token;
        results.tokenType = loginResponse.data.token_type || 'bearer';
      }
    }

  } catch (error: any) {
    results.tests.login = {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }

  // Summary with proper typing
  const summary: Summary = {
    canRegister: results.tests.register?.success || false,
    canLogin: results.tests.login?.success || false,
    tokenWorks: results.tests.tokenTest?.success || false,
    hasWorkingAuth: !!(results.newJwtToken && results.tests.tokenTest?.success),
    instruction: '' // Initialize empty
  };

  // Set instruction based on results
  if (summary.hasWorkingAuth) {
    summary.instruction = 'SUCCESS! Update your .env.local with the new JWT token below.';
  } else if (summary.canLogin) {
    summary.instruction = 'Login works but token validation failed. Check token format.';
  } else if (results.tests.register?.status === 422) {
    summary.instruction = 'User may already exist. Try login without registration.';
  } else {
    summary.instruction = 'Local auth endpoints may not be configured properly.';
  }

  results.summary = summary;

  res.json({
    success: true,
    results
  });
}
