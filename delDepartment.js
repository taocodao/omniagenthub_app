require('dotenv').config(); // Load environment variables
const { createClient } = require('@vercel/kv');

const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const deleteDepartmentMappings = async (departmentName) => {
    if (!departmentName) {
        console.error('Department name is required.');
        return;
    }

    try {
        const departmentPrefix = `department:${departmentName}`;
        const rolePrefix = `role:${departmentName}`;
        const taskPrefix = `task:${departmentName}`;

        // Fetch all keys related to the department
        const departmentKeys = await kv.keys(`${departmentPrefix}:*`);
        const roleKeys = await kv.keys(`${rolePrefix}:*`);
        const taskKeys = await kv.keys(`${taskPrefix}:*`);

        // Combine all keys
        const allKeys = [...departmentKeys, ...roleKeys, ...taskKeys];

        // Delete all related keys
        for (const key of allKeys) {
            await kv.del(key);
            console.log(`Deleted key: ${key}`);
        }

        // Optionally delete the department key itself (if you have a direct key for it)
        const departmentKey = `${departmentPrefix}`;
        await kv.del(departmentKey);
        console.log(`Deleted department key: ${departmentKey}`);

        console.log(`All mappings for department '${departmentName}' deleted successfully.`);
    } catch (error) {
        console.error('Error deleting mappings:', error);
    }
};

// Get the department name from the command-line arguments
const departmentName = process.argv[2]; // process.argv[2] is the first argument after the script name

if (!departmentName) {
    console.error('Please provide a department name.');
    process.exit(1);
}

deleteDepartmentMappings(departmentName);
