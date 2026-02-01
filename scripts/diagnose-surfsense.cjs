// scripts/diagnose-surfsense.cjs
const axios = require('axios');

const SURFSENSE_API_URL = 'https://surfsense-backend-730233624615.us-central1.run.app';
const SURFSENSE_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDQxOTIwZS0wZTgyLTQ5ODEtYmY4OC0yZGYxNTg3NWQ1ZTgiLCJhdWQiOlsiZmFzdGFwaS11c2VyczphdXRoIl0sImV4cCI6MTc2MDEyMzAyMX0.wjhnGjG6vKJLfVLPj3c5sHSq2VkvuoUZAs77_rq58z8';
const SEARCH_SPACE_ID = 13;

async function diagnose() {
  console.log('🔍 Diagnosing SurfSense API\n');

  try {
    // Test 1: Check search space exists
    console.log('📋 Test 1: Check search space exists');
    try {
      const spaceResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/searchspaces/${SEARCH_SPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`
          }
        }
      );
      console.log('✅ Search space exists:', JSON.stringify(spaceResponse.data, null, 2));
    } catch (e) {
      console.log('❌ Search space check failed:', e.response?.status, e.response?.data);
    }
    console.log('');

    // Test 2: List all search spaces
    console.log('📋 Test 2: List all search spaces');
    try {
      const spacesResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/searchspaces/`,
        {
          headers: {
            'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`
          }
        }
      );
      console.log('✅ All search spaces:', JSON.stringify(spacesResponse.data, null, 2));
    } catch (e) {
      console.log('❌ List search spaces failed:', e.response?.status, e.response?.data);
    }
    console.log('');

    // Test 3: Try different document endpoints
    console.log('📋 Test 3: Try different document list endpoints');
    
    const endpoints = [
      `/api/v1/documents/?search_space_id=${SEARCH_SPACE_ID}`,
      `/api/v1/documents/`,
      `/api/v1/searchspaces/${SEARCH_SPACE_ID}/documents`,
      `/api/v1/documents?search_space_id=${SEARCH_SPACE_ID}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(
          `${SURFSENSE_API_URL}${endpoint}`,
          {
            headers: {
              'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`
            }
          }
        );
        console.log(`✅ ${endpoint}:`, JSON.stringify(response.data, null, 2));
      } catch (e) {
        console.log(`❌ ${endpoint}:`, e.response?.status, e.message);
      }
    }
    console.log('');

    // Test 4: Check API documentation endpoint
    console.log('📋 Test 4: Check OpenAPI docs');
    try {
      const docsResponse = await axios.get(`${SURFSENSE_API_URL}/docs`);
      console.log('✅ Docs accessible at /docs');
    } catch (e) {
      console.log('❌ Docs check failed');
    }

    try {
      const openApiResponse = await axios.get(`${SURFSENSE_API_URL}/openapi.json`);
      console.log('✅ OpenAPI schema available');
      // Look for document endpoints
      const paths = openApiResponse.data.paths || {};
      const documentPaths = Object.keys(paths).filter(p => p.includes('document'));
      console.log('   Document-related endpoints:', documentPaths);
    } catch (e) {
      console.log('❌ OpenAPI check failed');
    }

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
  }
}

diagnose();
