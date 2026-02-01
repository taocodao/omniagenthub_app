require('dotenv').config(); // Load environment variables
const { createClient } = require('@vercel/kv');

const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const deleteMappings = async () => {
    try {
        // Fetch all department keys
        const departmentKeys = await kv.keys('department:*');
        for (const key of departmentKeys) {
            await kv.del(key);
            console.log(`Deleted key: ${key}`);
        }

        // Fetch all role keys
        const roleKeys = await kv.keys('role:*');
        for (const key of roleKeys) {
            await kv.del(key);
            console.log(`Deleted key: ${key}`);
        }

        console.log('All mappings deleted successfully.');
    } catch (error) {
        console.error('Error deleting mappings:', error);
    }
};

deleteMappings();
