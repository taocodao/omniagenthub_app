// utils/linkedinStorage.ts
// Persistent storage for LinkedIn integrations using Vercel KV

import { kv } from '@vercel/kv';

export interface LinkedInConnection {
    userId: string;
    composioConnectedAccountId: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'EXPIRED' | 'FAILED';
    connectedAt: string;
    lastCheckedAt?: string;
    scopes?: string[];
}

// KV key prefix for LinkedIn connections
const LINKEDIN_KEY_PREFIX = 'linkedin:connection:';

/**
 * Save LinkedIn connection data for a user
 */
export async function saveLinkedInConnection(
    userId: string,
    data: Omit<LinkedInConnection, 'userId'>
): Promise<void> {
    const key = `${LINKEDIN_KEY_PREFIX}${userId}`;
    const connectionData: LinkedInConnection = {
        userId,
        ...data,
    };

    await kv.set(key, JSON.stringify(connectionData));
    console.log(`💾 [LINKEDIN-STORAGE] Saved connection for user: ${userId}`);
}

/**
 * Get LinkedIn connection data for a user
 */
export async function getLinkedInConnection(
    userId: string
): Promise<LinkedInConnection | null> {
    const key = `${LINKEDIN_KEY_PREFIX}${userId}`;
    const data = await kv.get<string>(key);

    if (!data) {
        console.log(`🔍 [LINKEDIN-STORAGE] No connection found for user: ${userId}`);
        return null;
    }

    try {
        const connection = typeof data === 'string' ? JSON.parse(data) : data;
        console.log(`✅ [LINKEDIN-STORAGE] Found connection for user: ${userId}, status: ${connection.status}`);
        return connection as LinkedInConnection;
    } catch (error) {
        console.error(`❌ [LINKEDIN-STORAGE] Error parsing connection data:`, error);
        return null;
    }
}

/**
 * Update LinkedIn connection status
 */
export async function updateLinkedInConnectionStatus(
    userId: string,
    status: LinkedInConnection['status']
): Promise<boolean> {
    const existing = await getLinkedInConnection(userId);

    if (!existing) {
        console.log(`⚠️ [LINKEDIN-STORAGE] Cannot update - no connection for user: ${userId}`);
        return false;
    }

    await saveLinkedInConnection(userId, {
        ...existing,
        status,
        lastCheckedAt: new Date().toISOString(),
    });

    console.log(`🔄 [LINKEDIN-STORAGE] Updated status to ${status} for user: ${userId}`);
    return true;
}

/**
 * Delete LinkedIn connection for a user
 */
export async function deleteLinkedInConnection(userId: string): Promise<void> {
    const key = `${LINKEDIN_KEY_PREFIX}${userId}`;
    await kv.del(key);
    console.log(`🗑️ [LINKEDIN-STORAGE] Deleted connection for user: ${userId}`);
}

/**
 * Check if a user has an active LinkedIn connection
 */
export async function hasActiveLinkedInConnection(userId: string): Promise<boolean> {
    const connection = await getLinkedInConnection(userId);
    return connection?.status === 'ACTIVE';
}
