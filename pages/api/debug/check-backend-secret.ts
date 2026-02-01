// pages/api/debug/check-backend-secret.ts - FIXED VERSION
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const SURFSENSE_API_URL = process.env.SURFSENSE_API_URL || 'https://surfsense-backend-730233624615.us-central1.run.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Try to get OpenAPI spec to see auth configuration
    const openApiResponse = await axios.get(
      `${SURFSENSE_API_URL}/openapi.json`,
      {
        timeout: 10000,
        validateStatus: () => true
      }
    );

    const authEndpoints: string[] = []; // Fixed: Explicit typing
    const securitySchemes: Record<string, any> = {}; // Fixed: Explicit typing

    if (openApiResponse.status === 200) {
      const spec = openApiResponse.data;
      
      // Get auth endpoints
      Object.keys(spec.paths || {}).forEach(path => {
        if (path.includes('auth') || path.includes('login') || path.includes('register')) {
          authEndpoints.push(path);
        }
      });

      // Get security schemes
      if (spec.components?.securitySchemes) {
        Object.assign(securitySchemes, spec.components.securitySchemes);
      }
    }

    res.json({
      success: true,
      backendUrl: SURFSENSE_API_URL,
      openApiAvailable: openApiResponse.status === 200,
      authEndpoints: authEndpoints,
      securitySchemes: securitySchemes,
      recommendation: authEndpoints.length === 0 
        ? 'No auth endpoints found. Backend may have AUTH_TYPE=NONE or auth disabled.'
        : `Found ${authEndpoints.length} auth endpoints. Try manual JWT generation.`
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
