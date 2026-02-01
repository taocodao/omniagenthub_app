// scripts/setUsage.js

require('dotenv').config(); // Load environment variables from .env
const axios = require('axios');

// Configuration from environment variables
const ADDRESS = process.env.ADDRESS || '0x3ae3C71eeb08273A49c4Eb8642CFB25340C9bFDd';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';

// Utility function to generate random integer between min and max (inclusive)
const getRandomInt = (min = 1000, max = 5000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to fetch all departments
const getDepartments = async () => {
    console.log('📥 Fetching departments...');
    try {
        const response = await axios.post(`${BASE_URL}/get-departments`, {});
        if (response.status === 200) {
            console.log('✅ Departments fetched successfully:', response.data);
            return response.data; // Assuming it's an array of department names
        } else {
            console.error('❌ Failed to fetch departments:', response.status, response.statusText);
            return [];
        }
    } catch (error) {
        console.error('❌ Error fetching departments:', error.message);
        return [];
    }
};

// Function to fetch roles for a given department
const getRoles = async (department) => {
    console.log(`📥 Fetching roles for department "${department}"...`);
    try {
        const response = await axios.post(`${BASE_URL}/get-roles`, { department });
        if (response.status === 200) {
            console.log(`✅ Roles fetched for department "${department}":`, response.data.roles);
            return response.data.roles || [];
        } else {
            console.error(`❌ Failed to fetch roles for department "${department}":`, response.status, response.statusText);
            return [];
        }
    } catch (error) {
        console.error(`❌ Error fetching roles for department "${department}":`, error.message);
        return [];
    }
};

// Function to fetch current usage for a given role and department
const getCurrentUsage = async (department, role) => {
    console.log(`📥 Fetching current usage for role "${role}" in department "${department}"...`);
    try {
        const response = await axios.post(`${BASE_URL}/getUsage`, { department, role });
        if (response.status === 200 && typeof response.data.usage === 'number') {
            console.log(`✅ Current usage for role "${role}" in department "${department}": ${response.data.usage}`);
            return response.data.usage;
        } else {
            console.error(`❌ Failed to fetch usage for role "${role}" in department "${department}":`, response.status, response.statusText);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error fetching usage for role "${role}" in department "${department}":`, error.message);
        return null;
    }
};

// Function to set initial usage count for a given role and department
const setInitialUsage = async (department, role, initialCount) => {
    console.log(`📤 Setting initial usage for role "${role}" in department "${department}" to ${initialCount}...`);
    try {
        const response = await axios.post(`${BASE_URL}/updateUsage`, {
            department,
            role,
            initialCount
        });

        if (response.status === 200) {
            console.log(`✅ Successfully set initial usage for role "${role}" in department "${department}" to ${initialCount}`);
        } else {
            console.error(`❌ Failed to set initial usage for role "${role}" in department "${department}":`, response.status, response.statusText);
        }
    } catch (error) {
        if (error.response) {
            // Server responded with a status other than 2xx
            console.error(`❌ Error setting initial usage for role "${role}" in department "${department}":`, error.response.data);
        } else if (error.request) {
            // No response received
            console.error(`❌ No response received when setting initial usage for role "${role}" in department "${department}".`);
        } else {
            // Other errors
            console.error(`❌ Error setting up request for role "${role}" in department "${department}":`, error.message);
        }
    }
};

// Main function to orchestrate the process
const main = async () => {
    console.log('🚀 Script started.');

    // Parse command-line arguments
    const args = process.argv.slice(2);
    const mode = args[0] ? args[0].toLowerCase() : 'prod';

    if (!['test', 'prod'].includes(mode)) {
        console.error('❌ Invalid mode. Use "test" or "prod".');
        process.exit(1);
    }

    console.log(`⚙️ Running in "${mode}" mode.`);

    // Fetch departments
    const departments = await getDepartments();

    if (departments.length === 0) {
        console.error('❌ No departments found. Exiting.');
        process.exit(1);
    }

    // If mode is 'test', limit to one department
    const departmentsToProcess = mode === 'test' ? [departments[0]] : departments;

    console.log(`📊 Processing ${departmentsToProcess.length} department(s):`, departmentsToProcess);

    for (const department of departmentsToProcess) {
        console.log(`\n🔍 Processing department: "${department}"`);
        const roles = await getRoles(department);

        if (roles.length === 0) {
            console.warn(`⚠️ No roles found for department "${department}". Skipping.`);
            continue;
        }

        console.log(`📌 Found ${roles.length} role(s) in department "${department}":`, roles);

        // Create an array of promises for setting initial usage counts conditionally
        const usagePromises = roles.map(async (role) => {
            // Fetch current usage
            const currentUsage = await getCurrentUsage(department, role);

            if (currentUsage === null) {
                console.warn(`⚠️ Could not retrieve usage for role "${role}" in department "${department}". Skipping.`);
                return;
            }

            if (currentUsage < 1000) {
                const initialCount = getRandomInt(1000, 5000);
                console.log(`🔄 Role "${role}" has usage ${currentUsage} (<1000). Setting new usage to ${initialCount}.`);
                await setInitialUsage(department, role, initialCount);
            } else {
                console.log(`✅ Role "${role}" has sufficient usage (${currentUsage} >= 1000). No action needed.`);
            }

            // Optional: Introduce a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        });

        // Execute all usage submissions in parallel
        await Promise.all(usagePromises);
    }

    console.log('\n🎉 Initial usage setting process completed.');
};

// Execute the main function
main();
