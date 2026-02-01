// pages/api/test-backend.ts - Complete SurfSense Backend Test
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BACKEND_URL = 'https://surfsense-backend-730233624615.us-central1.run.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const results: any = {
    timestamp: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    tests: {}
  };

  console.log('🔍 Starting SurfSense Backend Tests...\n');

  // TEST 1: Basic Connectivity
  try {
    console.log('1️⃣ Testing basic connectivity...');
    const docsResponse = await axios.get(`${BACKEND_URL}/docs`, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    results.tests.connectivity = {
      success: docsResponse.status === 200,
      status: docsResponse.status,
      message: docsResponse.status === 200 
        ? '✅ Backend is reachable' 
        : `❌ Unexpected status: ${docsResponse.status}`
    };
    console.log(results.tests.connectivity.message);
  } catch (error: any) {
    results.tests.connectivity = {
      success: false,
      error: error.message,
      message: '❌ Backend is not reachable'
    };
    console.error(results.tests.connectivity.message);
  }

  // TEST 2: Health Endpoint
  try {
    console.log('\n2️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${BACKEND_URL}/health`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    results.tests.health = {
      success: healthResponse.status === 200,
      status: healthResponse.status,
      data: healthResponse.data,
      message: healthResponse.status === 200 
        ? '✅ Health check passed' 
        : `❌ Health check failed: ${healthResponse.status}`
    };
    console.log(results.tests.health.message);
  } catch (error: any) {
    results.tests.health = {
      success: false,
      error: error.message,
      message: '❌ Health endpoint error'
    };
    console.error(results.tests.health.message);
  }

  // TEST 3: Authentication - No Auth
  try {
    console.log('\n3️⃣ Testing without authentication...');
    const noAuthResponse = await axios.get(
      `${BACKEND_URL}/api/v1/search-spaces/`,
      {
        timeout: 10000,
        validateStatus: () => true
      }
    );
    
    results.tests.noAuth = {
      status: noAuthResponse.status,
      requiresAuth: noAuthResponse.status === 401,
      allowsNoAuth: noAuthResponse.status === 200,
      message: noAuthResponse.status === 401 
        ? '🔒 Backend requires authentication' 
        : noAuthResponse.status === 200 
        ? '✅ No authentication required (LOCAL mode)' 
        : `⚠️ Unexpected status: ${noAuthResponse.status}`
    };
    console.log(results.tests.noAuth.message);
  } catch (error: any) {
    results.tests.noAuth = {
      error: error.message,
      message: '❌ No-auth test failed'
    };
    console.error(results.tests.noAuth.message);
  }

  // TEST 4: Google OAuth Availability
  try {
    console.log('\n4️⃣ Testing Google OAuth...');
    const oauthResponse = await axios.get(
      `${BACKEND_URL}/auth/google/authorize`,
      {
        timeout: 5000,
        validateStatus: () => true,
        maxRedirects: 0
      }
    );
    
    results.tests.googleOAuth = {
      available: oauthResponse.status === 200 || (oauthResponse.status >= 300 && oauthResponse.status < 400),
      status: oauthResponse.status,
      message: results.tests.googleOAuth.available 
        ? '✅ Google OAuth is configured' 
        : '❌ Google OAuth not available'
    };
    console.log(results.tests.googleOAuth.message);
  } catch (error: any) {
    results.tests.googleOAuth = {
      available: false,
      error: error.message,
      message: '❌ Google OAuth test failed'
    };
    console.error(results.tests.googleOAuth.message);
  }

  // TEST 5: Try Local Auth Registration
  try {
    console.log('\n5️⃣ Testing local registration...');
    const registerResponse = await axios.post(
      `${BACKEND_URL}/api/v1/auth/register`,
      {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!',
        is_active: true,
        is_superuser: false,
        is_verified: true
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    
    results.tests.registration = {
      available: registerResponse.status === 201 || registerResponse.status === 200,
      status: registerResponse.status,
      message: registerResponse.status === 201 
        ? '✅ Registration works' 
        : registerResponse.status === 422 
        ? '⚠️ Registration endpoint available (user may exist)' 
        : `❌ Registration failed: ${registerResponse.status}`
    };
    console.log(results.tests.registration.message);
  } catch (error: any) {
    results.tests.registration = {
      available: false,
      error: error.message,
      message: '❌ Registration test failed'
    };
    console.error(results.tests.registration.message);
  }

  // SUMMARY
  console.log('\n📊 SUMMARY\n');
  
  const summary = {
    backendReachable: results.tests.connectivity?.success || false,
    healthyBackend: results.tests.health?.success || false,
    authRequired: results.tests.noAuth?.requiresAuth || false,
    googleOAuthAvailable: results.tests.googleOAuth?.available || false,
    localAuthAvailable: results.tests.registration?.available || false,
    recommendation: ''
  };

  // Generate recommendation
  if (!summary.backendReachable) {
    summary.recommendation = '❌ Backend is not reachable. Check your Cloud Run deployment.';
  } else if (!summary.healthyBackend) {
    summary.recommendation = '⚠️ Backend is reachable but unhealthy. Check logs for startup errors.';
  } else if (!summary.authRequired) {
    summary.recommendation = '✅ Backend is in LOCAL mode (no auth required). Ready to use!';
  } else if (summary.googleOAuthAvailable) {
    summary.recommendation = '🔐 Backend requires Google OAuth. Set AUTH_TYPE=LOCAL to disable.';
  } else if (summary.localAuthAvailable) {
    summary.recommendation = '🔐 Backend has local auth. Create user and get JWT token.';
  } else {
    summary.recommendation = '⚠️ Backend requires authentication but method is unclear.';
  }

  console.log('🎯 Recommendation:', summary.recommendation);
  console.log('\n✅ Test completed!\n');

  results.summary = summary;

  res.status(200).json({
    success: true,
    results
  });
}
