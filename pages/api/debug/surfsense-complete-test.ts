// pages/api/debug/surfsense-complete-test.ts - COMPLETE DIAGNOSTIC
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const SURFSENSE_API_URL = process.env.SURFSENSE_API_URL || 'https://surfsense-backend-6iucxb6k5a-uc.a.run.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    config: {
      backendUrl: SURFSENSE_API_URL,
      hasJwtToken: !!process.env.SURFSENSE_JWT_TOKEN,
      jwtTokenLength: process.env.SURFSENSE_JWT_TOKEN?.length || 0
    },
    tests: {}
  };

  console.log('🔍 Starting comprehensive SurfSense diagnostic...');

  // TEST 1: Basic connectivity
  try {
    console.log('🌐 Testing basic connectivity...');
    const pingResponse = await axios.get(`${SURFSENSE_API_URL}/docs`, { 
      timeout: 10000,
      validateStatus: () => true // Accept any status
    });
    
    results.tests.connectivity = {
      success: true,
      status: pingResponse.status,
      hasDocsEndpoint: pingResponse.status === 200,
      responseHeaders: pingResponse.headers
    };
  } catch (error: any) {
    results.tests.connectivity = {
      success: false,
      error: error.code || error.message,
      timeout: error.code === 'ECONNABORTED'
    };
  }

  // TEST 2: Try different auth methods
  console.log('🔐 Testing authentication methods...');
  
  // Test 2A: No authentication
  try {
    const noAuthResponse = await axios.get(
      `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
      { 
        timeout: 10000,
        validateStatus: () => true
      }
    );
    
    results.tests.noAuth = {
      success: noAuthResponse.status === 200,
      status: noAuthResponse.status,
      requiresAuth: noAuthResponse.status === 401
    };
  } catch (error: any) {
    results.tests.noAuth = {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }

  // Test 2B: With JWT token (if available)
  if (process.env.SURFSENSE_JWT_TOKEN) {
    try {
      const jwtResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.SURFSENSE_JWT_TOKEN}`
          },
          timeout: 10000,
          validateStatus: () => true
        }
      );
      
      results.tests.jwtAuth = {
        success: jwtResponse.status === 200,
        status: jwtResponse.status,
        data: jwtResponse.data,
        searchSpaceCount: Array.isArray(jwtResponse.data) ? jwtResponse.data.length : 0
      };
    } catch (error: any) {
      results.tests.jwtAuth = {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // TEST 3: Google OAuth endpoints
  try {
    console.log('🔍 Testing Google OAuth endpoints...');
    const oauthResponse = await axios.get(
      `${SURFSENSE_API_URL}/api/v1/auth/google`,
      { 
        timeout: 5000,
        validateStatus: () => true,
        maxRedirects: 0 // Don't follow redirects
      }
    );
    
    results.tests.googleOAuth = {
      success: true,
      status: oauthResponse.status,
      redirectUrl: oauthResponse.headers.location,
      isRedirect: oauthResponse.status >= 300 && oauthResponse.status < 400
    };
  } catch (error: any) {
    results.tests.googleOAuth = {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }

  // TEST 4: Try to create test search space (if authenticated)
  if (results.tests.jwtAuth?.success) {
    try {
      console.log('📝 Testing search space creation...');
      const createResponse = await axios.post(
        `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
        {
          name: 'Test Space - ' + Date.now(),
          description: 'Test space for diagnostic purposes'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.SURFSENSE_JWT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      results.tests.createSpace = {
        success: true,
        spaceId: createResponse.data.id,
        spaceData: createResponse.data
      };
      
      // Clean up - delete test space
      try {
        await axios.delete(
          `${SURFSENSE_API_URL}/api/v1/search-spaces/${createResponse.data.id}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.SURFSENSE_JWT_TOKEN}`
            },
            timeout: 5000
          }
        );
        results.tests.createSpace.cleanedUp = true;
      } catch (cleanupError) {
        results.tests.createSpace.cleanupError = 'Failed to cleanup test space';
      }
      
    } catch (error: any) {
      results.tests.createSpace = {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }

  // SUMMARY
  results.summary = {
    backendReachable: results.tests.connectivity?.success || false,
    authenticationRequired: results.tests.noAuth?.requiresAuth || false,
    jwtTokenWorks: results.tests.jwtAuth?.success || false,
    canCreateSpaces: results.tests.createSpace?.success || false,
    googleOAuthAvailable: results.tests.googleOAuth?.success || false,
    recommendation: getRecommendation(results.tests)
  };

  res.status(200).json({
    success: true,
    results
  });
}

function getRecommendation(tests: any): string {
  if (!tests.connectivity?.success) {
    return 'Backend is not reachable. Check your SURFSENSE_API_URL configuration.';
  }
  
  if (tests.jwtAuth?.success) {
    return 'JWT authentication is working! Your setup is ready to use.';
  }
  
  if (tests.noAuth?.requiresAuth) {
    if (tests.googleOAuth?.success) {
      return 'Backend requires Google OAuth. You need to authenticate via Google first.';
    }
    return 'Backend requires authentication but JWT token is invalid. Check your SURFSENSE_JWT_TOKEN.';
  }
  
  return 'Backend is reachable but authentication status unclear. Manual investigation needed.';
}
