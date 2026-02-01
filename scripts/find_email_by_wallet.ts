
import { createClient } from '@vercel/kv';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.error('KV_REST_API_URL or KV_REST_API_TOKEN is missing in .env');
    process.exit(1);
}

const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
});

const TARGET_WALLET = '0xDC5ECB5a773dce39B7925Eb7c2838517ca4938D0';

async function findEmailByWallet() {
    console.log(`Searching for email associated with wallet: ${TARGET_WALLET}`);

    try {
        let cursor = "0";
        let found = false;

        do {
            const result = await kv.scan(cursor, { match: 'Email_Leads:*', count: 100 });
            cursor = result[0];
            const keys = result[1];

            for (const key of keys) {
                const value = await kv.get(key);
                // The value might be a string (JSON) or an object if the client parses it
                // kv.get usually returns the value as is (parsed JSON if stored as JSON?)
                // In save-user-email.ts: await kv.set(emailLeadKey, JSON.stringify(leadData));
                // So it's stored as a stringified JSON.

                let data;
                if (typeof value === 'string') {
                    try {
                        data = JSON.parse(value);
                    } catch (e) {
                        // Ignore parsing errors
                        continue;
                    }
                } else {
                    data = value;
                }

                if (data && data.walletAddress && data.walletAddress.toLowerCase() === TARGET_WALLET.toLowerCase()) {
                    console.log(`\nFound match!`);
                    console.log(`Key: ${key}`);
                    console.log(`Email: ${data.email}`);
                    console.log(`Wallet: ${data.walletAddress}`);
                    console.log(`Data:`, data);
                    found = true;
                    // Depending on if we want ALL matches or just one.
                    // Let's keep searching to see if there are multiple entires.
                }
            }
        } while (cursor !== "0");

        if (!found) {
            console.log('\nNo matching email found in Email_Leads:* for this wallet.');
        }

    } catch (error) {
        console.error('Error scanning KV:', error);
    }
}

findEmailByWallet();
