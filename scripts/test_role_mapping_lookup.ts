
import { createClient } from '@vercel/kv';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

async function testMapping() {
    const username = "eric";
    console.log(`Testing lookup for user: "${username}"`);

    // Simulate the logic added to get-role-mappings.ts
    const searchName = username.toLowerCase().trim();

    try {
        // Scan all userName:* keys
        const keys: string[] = [];
        let cursor = "0";

        do {
            const result = await kv.scan(cursor, { match: 'userName:*', count: 100 });
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor !== "0");

        console.log(`Scanned ${keys.length} userName keys.`);

        // Check each key for matching username
        for (const key of keys) {
            const storedName = await kv.get<string>(key);
            if (storedName && storedName.toLowerCase().trim() === searchName) {
                const address = key.replace('userName:', '');
                console.log(`\n✅ SUCCESS! Found match:`);
                console.log(`User: "${storedName}"`);
                console.log(`Address: ${address}`);

                if (address === '0xDC5ECB5a773dce39B7925Eb7c2838517ca4938D0') {
                    console.log(`\n🎉 VERIFIED: Matches expected wallet address!`);
                } else {
                    console.log(`\n⚠️ Mismatch: Expected 0xDC5ECB5a773dce39B7925Eb7c2838517ca4938D0`);
                }
                return;
            }
        }

        console.log(`\n❌ No match found for "${username}"`);

    } catch (error) {
        console.error('Error:', error);
    }
}

testMapping();
