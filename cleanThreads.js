require('dotenv').config();
const { createClient } = require('@vercel/kv');

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    throw new Error('Missing required environment variables');
}

const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
});

const cleanThreadMappings = async () => {
    try {
        // Fetch all keys that match the pattern 'thread:*'
        const threadKeys = await kv.keys('thread:*');
        console.log(`Found ${threadKeys.length} thread keys to delete`);

        // Delete each key
        for (const key of threadKeys) {
            await kv.del(key);
            console.log(`Deleted ${key}`);
        }

        console.log('Thread mappings cleanup completed successfully');
    } catch (error) {
        console.error('Error cleaning thread mappings:', error);
    }
};

// Run the cleanup function
cleanThreadMappings();
