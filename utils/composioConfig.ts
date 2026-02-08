// utils/composioConfig.ts
// Server-side Composio SDK configuration

import { Composio } from '@composio/client';

if (!process.env.COMPOSIO_API_KEY) {
    console.warn('⚠️ [COMPOSIO] COMPOSIO_API_KEY not set in environment variables');
}

// Initialize Composio client (singleton pattern)
let composioInstance: Composio | null = null;

export function getComposioClient(): Composio {
    if (!composioInstance) {
        if (!process.env.COMPOSIO_API_KEY) {
            throw new Error('COMPOSIO_API_KEY environment variable is not set');
        }

        composioInstance = new Composio({
            apiKey: process.env.COMPOSIO_API_KEY,
        });

        console.log('✅ [COMPOSIO] Client initialized successfully');
    }

    return composioInstance;
}

// LinkedIn Auth Config ID from Composio dashboard
export const LINKEDIN_AUTH_CONFIG_ID = process.env.COMPOSIO_LINKEDIN_AUTH_CONFIG_ID || '';

// Generate a unique user ID for Composio scoping
// Uses the Auth0 user ID or a custom identifier
export function getComposioUserId(auth0UserId: string): string {
    // Stable unique identifier format for multi-tenant safety
    return `omniagent:${auth0UserId}`;
}
