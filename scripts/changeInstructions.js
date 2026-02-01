// scripts/changeInstructions.js

require('dotenv').config(); // Load environment variables from .env
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api'; // Base URL for your APIs
const UPDATE_INSTRUCTION_ENDPOINT = `${BASE_URL}/update_instruction`;
const GET_DEPARTMENTS_ENDPOINT = `${BASE_URL}/get-departments`;
const GET_ROLES_ENDPOINT = `${BASE_URL}/get-roles`;
const GET_TASKS_ENDPOINT = `${BASE_URL}/get-tasks`;

const API_KEY = process.env.API_KEY || ''; // If your APIs are secured with an API key
const MODE = process.env.MODE || 'prod'; // Can be 'prod', 'test', or 'pretest'

// Validate Environment Variables
if (!BASE_URL) {
    console.error('Error: BASE_URL is not defined in the environment variables.');
    process.exit(1);
}

// Helper function to perform Axios requests with custom retry
/**
 * Performs an Axios request with a custom retry mechanism.
 * @param {Object} axiosConfig - The Axios request configuration.
 * @param {number} retries - Number of retry attempts.
 * @param {number} retryDelay - Delay between retries in milliseconds.
 * @returns {Promise} - Resolves with Axios response or rejects after exhausting retries.
 */
const axiosRequestWithRetry = async (axiosConfig, retries = 3, retryDelay = 1000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios(axiosConfig);
            return response;
        } catch (error) {
            const shouldRetry =
                error.code === 'ECONNABORTED' || // Timeout
                error.code === 'ENOTFOUND' || // DNS lookup failed
                (error.response && error.response.status >= 500); // Server errors

            if (!shouldRetry) {
                throw error; // Do not retry for client errors (4xx) or other non-retriable errors
            }

            if (attempt < retries) {
                console.warn(`Attempt ${attempt} failed for ${axiosConfig.url}. Retrying in ${retryDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
                console.error(`All ${retries} retry attempts failed for ${axiosConfig.url}.`);
                throw error;
            }
        }
    }
};

// Function to fetch all departments with retry
const getDepartments = async () => {
    const axiosConfig = {
        method: 'post',
        url: GET_DEPARTMENTS_ENDPOINT,
        headers: {
            'Content-Type': 'application/json',
            ...(API_KEY && { 'x-api-key': API_KEY })
        },
        data: {}
    };

    try {
        const response = await axiosRequestWithRetry(axiosConfig);
        if (response.status === 200) {
            return response.data; // Assuming it's an array of department names
        } else {
            console.error(`Failed to fetch departments: ${response.status} ${response.statusText}`);
            return [];
        }
    } catch (error) {
        if (error.response) {
            console.error(`Error fetching departments: ${error.response.status} - ${error.response.data.error}`);
        } else if (error.request) {
            console.error(`Error fetching departments: No response received from the server.`);
        } else {
            console.error(`Error fetching departments: ${error.message}`);
        }
        return [];
    }
};

// Function to fetch roles for a given department with retry
const getRoles = async (department) => {
    const axiosConfig = {
        method: 'post',
        url: GET_ROLES_ENDPOINT,
        headers: {
            'Content-Type': 'application/json',
            ...(API_KEY && { 'x-api-key': API_KEY })
        },
        data: { department }
    };

    try {
        const response = await axiosRequestWithRetry(axiosConfig);
        if (response.status === 200) {
            return response.data.roles || [];
        } else {
            console.error(`Failed to fetch roles for department "${department}": ${response.status} ${response.statusText}`);
            return [];
        }
    } catch (error) {
        if (error.response) {
            console.error(`Error fetching roles for department "${department}": ${error.response.status} - ${error.response.data.error}`);
        } else if (error.request) {
            console.error(`Error fetching roles for department "${department}": No response received from the server.`);
        } else {
            console.error(`Error fetching roles for department "${department}": ${error.message}`);
        }
        return [];
    }
};

// Function to fetch tasks for a given department and role with retry
const getTasks = async (department, role) => {
    const axiosConfig = {
        method: 'post',
        url: GET_TASKS_ENDPOINT,
        headers: {
            'Content-Type': 'application/json',
            ...(API_KEY && { 'x-api-key': API_KEY })
        },
        data: { department, role }
    };

    try {
        const response = await axiosRequestWithRetry(axiosConfig);
        if (response.status === 200) {
            return response.data.tasks || [];
        } else {
            console.error(`Failed to fetch tasks for role "${role}" in department "${department}": ${response.status} ${response.statusText}`);
            return [];
        }
    } catch (error) {
        if (error.response) {
            console.error(`Error fetching tasks for role "${role}" in department "${department}": ${error.response.status} - ${error.response.data.error}`);
        } else if (error.request) {
            console.error(`Error fetching tasks for role "${role}" in department "${department}": No response received from the server.`);
        } else {
            console.error(`Error fetching tasks for role "${role}" in department "${department}": ${error.message}`);
        }
        return [];
    }
};

// Function to update instruction via API with retry
const updateInstruction = async (department, role, task, mode) => {
    const payload = {
        department,
        role,
        task,
        mode
    };

    const axiosConfig = {
        method: 'post',
        url: UPDATE_INSTRUCTION_ENDPOINT,
        headers: {
            'Content-Type': 'application/json',
            ...(API_KEY && { 'x-api-key': API_KEY })
        },
        data: payload
    };

    try {
        const response = await axiosRequestWithRetry(axiosConfig);
        console.log(`[SUCCESS] ${department} -> ${role} -> ${task}: ${response.data.message}`);
        return { success: true };
    } catch (error) {
        if (error.response) {
            console.error(`[ERROR] ${department} -> ${role} -> ${task}: ${error.response.status} - ${error.response.data.error}`);
        } else if (error.request) {
            console.error(`[ERROR] ${department} -> ${role} -> ${task}: No response received from the server.`);
        } else {
            console.error(`[ERROR] ${department} -> ${role} -> ${task}: ${error.message}`);
        }
        return { success: false, reason: error.message };
    }
};

// Function to write failed tasks to a JSON file
const writeFailedTasksToFile = (failedTasks) => {
    const outputPath = path.join(__dirname, 'failedTasks.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(failedTasks, null, 2), 'utf-8');
        console.log(`Failed tasks have been written to ${outputPath}`);
    } catch (error) {
        console.error(`Error writing failed tasks to file: ${error.message}`);
    }
};

// Function to process promises in batches
const processInBatches = async (tasks, batchSize = 5) => {
    for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        await Promise.all(batch.map(task => task()));
    }
};

// Main function to orchestrate the process
const main = async () => {
    console.log(`\n[${new Date().toISOString()}] Script started.`);

    // Parse command-line arguments
    const args = process.argv.slice(2);
    const mode = args[0] ? args[0].toLowerCase() : MODE;

    if (!['test', 'prod', 'pretest'].includes(mode)) {
        console.error(`[${new Date().toISOString()}] Invalid mode "${mode}". Use "test", "prod", or "pretest". Exiting.`);
        process.exit(1);
    }

    console.log(`[${new Date().toISOString()}] Running in "${mode}" mode.`);

    // Fetch departments
    const departments = await getDepartments();

    if (departments.length === 0) {
        console.error(`[${new Date().toISOString()}] No departments found. Exiting.`);
        process.exit(1);
    }

    // Determine departments to process based on mode
    let departmentsToProcess = [];
    if (mode === 'test' || mode === 'pretest') {
        departmentsToProcess = [departments[0]];
    } else {
        departmentsToProcess = departments;
    }

    console.log(`[${new Date().toISOString()}] Processing ${departmentsToProcess.length} department(s): ${departmentsToProcess.join(', ')}`);

    // Initialize an array to hold failed tasks
    const failedTasks = [];

    // Collect all update tasks as functions
    const updateTasks = [];

    for (const department of departmentsToProcess) {
        console.log(`\n[${new Date().toISOString()}] Processing department: "${department}"`);

        let roles = await getRoles(department);

        if (roles.length === 0) {
            console.warn(`[${new Date().toISOString()}] No roles found for department "${department}". Skipping.`);
            continue;
        }

        // Limit roles to the first one in 'test' and 'pretest' modes
        if (mode === 'test' || mode === 'pretest') {
            roles = roles.slice(0, 1);
        }

        console.log(`[${new Date().toISOString()}] Found ${roles.length} role(s) in department "${department}": ${roles.join(', ')}`);

        for (const role of roles) {
            console.log(`[${new Date().toISOString()}] Processing role: "${role}" in department "${department}"`);

            let tasks = await getTasks(department, role);

            if (tasks.length === 0) {
                console.warn(`[${new Date().toISOString()}] No tasks found for role "${role}" in department "${department}". Skipping.`);
                continue;
            }

            // Limit tasks to the first one in 'test' and 'pretest' modes
            if (mode === 'test' || mode === 'pretest') {
                tasks = tasks.slice(0, 1);
            }

            console.log(`[${new Date().toISOString()}] Found ${tasks.length} task(s) in role "${role}" of department "${department}": ${tasks.join(', ')}`);

            for (const task of tasks) {
                console.log(`[${new Date().toISOString()}] Processing task: "${task}" in role "${role}" of department "${department}"`);

                // Define the update function
                const updateFunc = async () => {
                    const result = await updateInstruction(department, role, task, mode);
                    if (!result.success) {
                        failedTasks.push({ department, role, task, reason: result.reason });
                    }
                };

                updateTasks.push(updateFunc);

                // Break after one task in 'test' and 'pretest' modes
                if (mode === 'test' || mode === 'pretest') {
                    break;
                }
            }

            // Break after one role in 'test' and 'pretest' modes
            if (mode === 'test' || mode === 'pretest') {
                break;
            }
        }
    }

    // Process updates in batches to control concurrency
    const CONCURRENT_BATCH_SIZE = 5; // Number of concurrent requests
    await processInBatches(updateTasks, CONCURRENT_BATCH_SIZE);

    // If there are failed tasks, write them to a JSON file
    if (failedTasks.length > 0) {
        writeFailedTasksToFile(failedTasks);
        console.error(`[${new Date().toISOString()}] Some tasks failed to update instructions. Check 'failedTasks.json' for details.`);
    } else {
        console.log(`[${new Date().toISOString()}] All task instructions updated successfully.`);
    }

    console.log(`[${new Date().toISOString()}] Instruction updating process completed.\n`);
};

// Execute the main function
main();
