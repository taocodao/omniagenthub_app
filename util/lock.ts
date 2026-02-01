// util/lock.ts

import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

/**
 * Attempts to acquire a lock for a specific key.
 * @param lockKey The unique key for the lock.
 * @param ttl Time-to-live for the lock in seconds.
 * @returns True if the lock was acquired, false otherwise.
 */
export async function acquireLock(lockKey: string, ttl: number = 60): Promise<boolean> {
    const result = await kv.setnx(lockKey, 'locked');
    if (result === 1) {
        // Set expiration to prevent deadlocks
        await kv.expire(lockKey, ttl);
        return true;
    }
    return false;
}

/**
 * Releases a previously acquired lock.
 * @param lockKey The unique key for the lock.
 */
export async function releaseLock(lockKey: string): Promise<void> {
    await kv.del(lockKey);
}
