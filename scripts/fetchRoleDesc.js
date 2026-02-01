// scripts/fetchRoleDesc.js

import dotenv from 'dotenv'; // Load environment variables from .env
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Emulate __dirname and __filename in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize environment variables
dotenv.config();

// Configuration from environment variables
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';

// Function to fetch all departments
const getDepartments = async () => {
    console.log(`[${new Date().toISOString()}] Fetching departments...`);
    try {
        const response = await axios.post(`${BASE_URL}/get-departments`, {});
        if (response.status === 200) {
            console.log(`[${new Date().toISOString()}] Departments fetched successfully:`, response.data);
            return response.data; // Assuming it's an array of department names
        } else {
            console.error(`[${new Date().toISOString()}] Failed to fetch departments: ${response.status} ${response.statusText}`);
            return [];
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching departments:`, error.message);
        return [];
    }
};

// Function to fetch roles for a given department
const getRoles = async (department) => {
    console.log(`[${new Date().toISOString()}] Fetching roles for department "${department}"...`);
    try {
        const response = await axios.post(`${BASE_URL}/get-roles`, { department });
        if (response.status === 200) {
            console.log(`[${new Date().toISOString()}] Roles fetched for department "${department}":`, response.data.roles);
            return response.data.roles || [];
        } else {
            console.error(`[${new Date().toISOString()}] Failed to fetch roles for department "${department}": ${response.status} ${response.statusText}`);
            return [];
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching roles for department "${department}":`, error.message);
        return [];
    }
};

// Function to fetch role description for a given department and role
const getRoleDescription = async (department, role, language = 'English') => {
    console.log(`[${new Date().toISOString()}] Fetching description for role "${role}" in department "${department}" with language "${language}"...`);
    try {
        const response = await axios.post(`${BASE_URL}/get_role_description`, {
            department,
            role,
            language,
        });

        if (response.status === 200 && response.data.description) {
            console.log(`[${new Date().toISOString()}] Description fetched successfully for role "${role}" in department "${department}".`);
            return response.data.description;
        } else {
            console.warn(`[${new Date().toISOString()}] Description missing or empty for role "${role}" in department "${department}".`);
            return null;
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching description for role "${role}" in department "${department}":`, error.message);
        return null;
    }
};

// Function to write failed roles to a JSON file
const writeFailedRolesToFile = (failedRoles) => {
    const outputPath = path.join(__dirname, 'failedRoles.json');
    fs.writeFileSync(outputPath, JSON.stringify(failedRoles, null, 2), 'utf-8');
    console.log(`[${new Date().toISOString()}] Failed roles have been written to ${outputPath}`);
};

// Main function to orchestrate the fetching process
const main = async () => {
    console.log(`[${new Date().toISOString()}] Script started.`);

    // Parse command-line arguments
    const args = process.argv.slice(2);
    const mode = args[0] ? args[0].toLowerCase() : 'prod';

    if (!['test', 'prod'].includes(mode)) {
        console.error(`[${new Date().toISOString()}] Invalid mode "${mode}". Use "test" or "prod". Exiting.`);
        process.exit(1);
    }

    console.log(`[${new Date().toISOString()}] Running in "${mode}" mode.`);

    // Fetch departments
    const departments = await getDepartments();

    if (departments.length === 0) {
        console.error(`[${new Date().toISOString()}] No departments found. Exiting.`);
        process.exit(1);
    }

    // If mode is 'test', limit to one department
    const departmentsToProcess = mode === 'test' ? [departments[0]] : departments;
    console.log(`[${new Date().toISOString()}] Processing ${departmentsToProcess.length} department(s):`, departmentsToProcess);

    // Initialize an array to hold failed roles
    const failedRoles = [];

    for (const department of departmentsToProcess) {
        console.log(`[${new Date().toISOString()}] \nProcessing department: "${department}"`);
        const roles = await getRoles(department);

        if (roles.length === 0) {
            console.warn(`[${new Date().toISOString()}] No roles found for department "${department}". Skipping.`);
            continue;
        }

        console.log(`[${new Date().toISOString()}] Found ${roles.length} role(s) in department "${department}":`, roles);

        for (const role of roles) {
            const description = await getRoleDescription(department, role, 'English');

            if (!description) {
                // If fetching description failed or description is empty, add to failedRoles
                failedRoles.push({ department, role });
                console.error(`[${new Date().toISOString()}] Failed to fetch description for role "${role}" in department "${department}".`);
            } else {
                console.log(`[${new Date().toISOString()}] Successfully fetched description for role "${role}" in department "${department}".`);
            }

            // Optional: Introduce a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
    }

    // If there are failed roles, write them to a JSON file
    if (failedRoles.length > 0) {
        writeFailedRolesToFile(failedRoles);
        console.error(`[${new Date().toISOString()}] Fetched descriptions for some roles failed. Check 'failedRoles.json' for details.`);
    } else {
        console.log(`[${new Date().toISOString()}] All role descriptions fetched successfully.`);
    }

    console.log(`[${new Date().toISOString()}] Role description fetching process completed.`);
};

// Execute the main function
main();
