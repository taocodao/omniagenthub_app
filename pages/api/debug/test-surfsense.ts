// pages/api/debug/test-surfsense.ts - COMPREHENSIVE SURFSENSE DIAGNOSTIC
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const SURFSENSE_API_URL = process.env.SURFSENSE_API_URL || 'https://surfsense-backend-730233624615.us-central1.run.app';
const SURFSENSE_JWT_TOKEN = process.env.SURFSENSE_JWT_TOKEN!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SURFSENSE_JWT_TOKEN) {
    return res.status(500).json({ error: 'SURFSENSE_JWT_TOKEN not configured' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    console.log('🔍 Starting comprehensive SurfSense diagnostic...');

    // TEST 1: Check SurfSense API health
    try {
      console.log('🏥 Testing API health...');
      const healthResponse = await axios.get(
        `${SURFSENSE_API_URL}/health`,
        { timeout: 5000 }
      );
      results.tests.apiHealth = {
        success: true,
        status: healthResponse.status,
        data: healthResponse.data
      };
    } catch (error: any) {
      results.tests.apiHealth = {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }

    // TEST 2: List all search spaces
    try {
      console.log('📋 Listing all search spaces...');
      const spacesResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
        {
          headers: { 'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}` },
          timeout: 10000
        }
      );
      
      const spaces = spacesResponse.data;
      results.tests.searchSpaces = {
        success: true,
        count: spaces?.length || 0,
        spaces: spaces?.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          created_at: s.created_at,
          document_count: s.document_count || 0
        })) || []
      };
      
      console.log(`✅ Found ${spaces?.length || 0} search spaces`);
    } catch (error: any) {
      results.tests.searchSpaces = {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }

    // TEST 3: Test each search space for document content
    if (results.tests.searchSpaces?.success && results.tests.searchSpaces.spaces?.length > 0) {
      console.log('🔍 Testing each search space for indexed documents...');
      
      const spaceTests = [];
      
      for (const space of results.tests.searchSpaces.spaces) {
        console.log(`Testing space ${space.id}: ${space.name}`);
        
        const spaceTest: any = {
          spaceId: space.id,
          spaceName: space.name,
          documentCount: space.document_count
        };

        try {
          // Quick test query with 10 second timeout
          const testResponse = await axios.post(
            `${SURFSENSE_API_URL}/api/v1/chat`,
            {
              messages: [{ role: 'user', content: 'hello' }],
              data: {
                search_space_id: space.id,
                research_mode: "QNA",
                selected_connectors: [],
                search_mode: "CHUNKS"
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000 // 10 second timeout
            }
          );

          spaceTest.chatTest = {
            success: true,
            hasResponse: !!testResponse.data,
            responseLength: testResponse.data?.length || 0,
            responsePreview: testResponse.data?.substring(0, 200) || ''
          };

          console.log(`✅ Space ${space.id} responded with ${testResponse.data?.length || 0} chars`);

        } catch (error: any) {
          spaceTest.chatTest = {
            success: false,
            error: error.code || error.message,
            timeout: error.code === 'ECONNABORTED',
            status: error.response?.status
          };

          if (error.code === 'ECONNABORTED') {
            console.log(`⏰ Space ${space.id} timed out (likely empty)`);
          } else {
            console.log(`❌ Space ${space.id} error: ${error.message}`);
          }
        }

        spaceTests.push(spaceTest);
      }

      results.tests.spaceTests = spaceTests;
    }

    // TEST 4: Find working spaces
    const workingSpaces = results.tests.spaceTests?.filter((test: any) => 
      test.chatTest?.success && test.chatTest?.responseLength > 0
    ) || [];

    results.tests.summary = {
      totalSpaces: results.tests.searchSpaces?.count || 0,
      workingSpaces: workingSpaces.length,
      emptySpaces: (results.tests.spaceTests?.length || 0) - workingSpaces.length,
      recommendedSpace: workingSpaces[0]?.spaceId || null
    };

    console.log(`📊 Summary: ${workingSpaces.length} working spaces out of ${results.tests.searchSpaces?.count || 0} total`);

    res.status(200).json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      results
    });
  }
}
