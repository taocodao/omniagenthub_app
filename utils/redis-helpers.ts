import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Helper function to scan all keys matching a pattern
export async function scanAllKeys(pattern: string): Promise<string[]> {
    let cursor = "0";  // Changed to string type
    let allKeys: string[] = [];

    do {
        const scanResult = await kv.scan(cursor, {
            match: pattern,
            count: 100
        });

        cursor = scanResult[0] as string;  // Fixed casting to string
        const keys = scanResult[1] as string[];

        allKeys = allKeys.concat(keys);

    } while (cursor !== "0");  // Changed comparison to string "0"

    return allKeys;
}


// Export KV instance for other operations
export { kv };
