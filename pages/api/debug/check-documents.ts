// pages/api/debug/check-documents.ts - FIXED
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

  const { searchSpaceId } = req.query;

  if (!searchSpaceId) {
    return res.status(400).json({ error: 'Missing searchSpaceId parameter' });
  }

  if (!SURFSENSE_JWT_TOKEN) {
    return res.status(500).json({ error: 'SURFSENSE_JWT_TOKEN not configured' });
  }

  try {
    console.log(`🔍 Checking search space: ${searchSpaceId}`);

    const results: any = {
      searchSpaceId: searchSpaceId,
      checks: {}
    };

    // 1. Get search space info
    try {
      const spaceResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/search-spaces/${searchSpaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`
          }
        }
      );
      results.checks.searchSpace = {
        success: true,
        data: spaceResponse.data
      };
      console.log('✅ Search space exists:', spaceResponse.data);
    } catch (error: any) {
      results.checks.searchSpace = {
        success: false,
        error: error.response?.data || error.message
      };
      console.error('❌ Search space check failed:', error.response?.data);
    }

    // 2. Try to list search spaces to find ours
    try {
      const spacesListResponse = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/search-spaces/`,
        {
          headers: {
            'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`
          }
        }
      );
      
      const mySpace = spacesListResponse.data?.find((s: any) => s.id === parseInt(searchSpaceId as string));
      results.checks.searchSpacesList = {
        success: true,
        totalSpaces: spacesListResponse.data?.length || 0,
        foundMySpace: !!mySpace,
        mySpaceData: mySpace
      };
      console.log('✅ Total search spaces:', spacesListResponse.data?.length);
      console.log('✅ Found my space:', mySpace);
    } catch (error: any) {
      results.checks.searchSpacesList = {
        success: false,
        error: error.response?.data || error.message
      };
      console.error('❌ List spaces failed:', error.response?.data);
    }

    // 3. Try to search/query the space to see if documents exist
    try {
      const chatTestResponse = await axios.post(
        `${SURFSENSE_API_URL}/api/v1/chat`,
        {
          messages: [{
            role: 'user',
            content: 'hello'
          }],
          data: {
            search_space_id: parseInt(searchSpaceId as string),
            research_mode: "QNA",
            selected_connectors: [],
            search_mode: "CHUNKS",
            document_ids_to_add_in_context: []
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000,
          responseType: 'text'
        }
      );

      // Check if we got any response
      const hasContent = chatTestResponse.data && chatTestResponse.data.length > 0;
      results.checks.chatTest = {
        success: true,
        hasContent: hasContent,
        responseLength: chatTestResponse.data?.length || 0,
        response: chatTestResponse.data?.substring(0, 200) // First 200 chars
      };
      console.log('✅ Chat test response length:', chatTestResponse.data?.length);
    } catch (error: any) {
      results.checks.chatTest = {
        success: false,
        error: error.response?.data || error.message
      };
      console.error('❌ Chat test failed:', error.response?.data);
    }

    return res.status(200).json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('❌ Error in check-documents:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
}
