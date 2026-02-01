require('dotenv').config(); // Load environment variables
const { createClient } = require('@vercel/kv');

// Initialize KV Client
const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

// Function to fetch all keys and find department-related keys
async function fetchAllKeys() {
    try {
        // Fetch all keys in the KV store (adjust this based on how your KV store handles key listing)
        const allKeys = await kv.keys('*'); // Assumes that kv.keys() returns all keys

        console.log('All Keys in KV Store:');
        console.log(allKeys);

        return allKeys;
    } catch (error) {
        console.error('Error fetching all keys:', error);
        process.exit(1);
    }
}

// Function to fetch all departments, roles, and tasks
async function fetchAllDepartmentsRolesTasks() {
    try {
        const departmentsKey = `departments:list`;
        let departments = await kv.get(departmentsKey);

        // If no departments found, try fetching all keys and find department-related ones
        if (!departments) {
            console.log('No departments found at the key:', departmentsKey);

            // Attempt to list all keys to check the correct structure
            const allKeys = await fetchAllKeys();

            // Try to extract department names from keys
            departments = allKeys
                .filter(key => key.startsWith('department:') && key.endsWith(':roles'))
                .map(key => key.split(':')[1]); // Extract department name from key format

            console.log('Departments inferred from keys:', departments);
        }

        if (!departments.length) {
            console.log('No departments could be found.');
            return;
        }

        console.log('Departments:', departments);

        for (const department of departments) {
            const departmentRolesKey = `department:${department}:roles`;
            const roles = await kv.get(departmentRolesKey);

            console.log(`\nDepartment: ${department}`);
            console.log('Roles:', roles || 'No roles found');

            if (roles) {
                for (const role of roles) {
                    const roleTasksKey = `department:${department}:role:${role}:tasks`;
                    const tasks = await kv.get(roleTasksKey);

                    console.log(`\n  Role: ${role}`);
                    console.log('  Tasks:', tasks || 'No tasks found');
                }
            }
        }
    } catch (error) {
        console.error('Error fetching departments, roles, or tasks:', error);
        process.exit(1);
    }
}

// Main function to handle command-line execution
async function main() {
    await fetchAllDepartmentsRolesTasks();
}

// Run the main function if executed via Node.js
if (require.main === module) {
    main();
}
