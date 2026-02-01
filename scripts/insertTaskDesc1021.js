// scripts/insertTaskDesc.js

import 'dotenv/config'; // Load environment variables from .env
import axios from 'axios';
import fs from 'fs';
import path from 'path';
//import { PineconeClient } from '@pinecone-database/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
// Define __dirname for ESM modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
    api: {
        bodyParser: false,
    },
};

// Initialize OpenAI

//const openai = new OpenAIApi(configuration);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const indexName = 'task-descriptions'; // Ensure this index exists

// Function to store embeddings in Pinecone
const storeEmbedding = async (embedding, metadata) => {
    const index = pinecone.Index(indexName);
    const vectors = [
        {
            id: metadata.id, // A unique identifier for the vector
            values: embedding,
            metadata: metadata,
        },
    ];
    await index.upsert(vectors);
};


// Function to fetch all departments
const getDepartments = async () => {
    console.log(`[${new Date().toISOString()}] Fetching departments...`);
    try {
        const response = await axios.post(`${BASE_URL}/get-departments`, {});
        if (response.status === 200) {
            console.log(`[${new Date().toISOString()}] Departments fetched successfully.`);
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
            console.log(`[${new Date().toISOString()}] Roles fetched for department "${department}".`);
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

// Function to fetch tasks for a given department and role
const getTasks = async (department, role) => {
    console.log(`[${new Date().toISOString()}] Fetching tasks for role "${role}" in department "${department}"...`);
    try {
        const response = await axios.post(`${BASE_URL}/get-tasks`, { department, role });
        if (response.status === 200) {
            console.log(`[${new Date().toISOString()}] Tasks fetched for role "${role}" in department "${department}".`);
            return response.data.tasks || [];
        } else {
            console.error(`[${new Date().toISOString()}] Failed to fetch tasks for role "${role}" in department "${department}": ${response.status} ${response.statusText}`);
            return [];
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching tasks for role "${role}" in department "${department}":`, error.message);
        return [];
    }
};

// Function to fetch task description with retry mechanism
const fetchTaskDescription = async (department, role, task, language = 'English', retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`[${new Date().toISOString()}] Attempt ${attempt}: Fetching description for task "${task}" in role "${role}" of department "${department}"...`);
        try {
            const response = await axios.post(`${BASE_URL}/get_task_description`, {
                department,
                role,
                task,
                language,
            });

            if (response.status === 200 && response.data.description) {
                console.log(`[${new Date().toISOString()}] Successfully fetched description for task "${task}".`);
                return response.data.description;
            } else {
                console.warn(`[${new Date().toISOString()}] Attempt ${attempt}: Description missing or empty for task "${task}".`);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Attempt ${attempt}: Error fetching description for task "${task}":`, error.message);
        }

        // Wait before retrying
        if (attempt < retries) {
            console.log(`[${new Date().toISOString()}] Waiting 1 second before retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
    }

    // After all retries, return null to indicate failure
    console.error(`[${new Date().toISOString()}] Failed to fetch description for task "${task}" after ${retries} attempts.`);
    return null;
};

// Function to process each task
const processTask = async (department, role, task) => {
    const description = await fetchTaskDescription(department, role, task, 'English', 3);

    if (!description) {
        // Handle failed tasks
        failedTasks.push({ department, role, task });
        return;
    }

    // Generate embedding for the description
    try {
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: description,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // Prepare metadata
        const metadata = {
            id: `${department}-${role}-${task}`, // Unique ID
            department: department,
            role: role,
            task: task,
            description: description,
        };

        // Store in Pinecone
        await storeEmbedding(embedding, metadata);
        console.log(`[${new Date().toISOString()}] Successfully stored embedding for task "${task}".`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error generating embedding for task "${task}":`, error.message);
        failedTasks.push({ department, role, task });
    }
};


// Function to write failed tasks to a JSON file
const writeFailedTasksToFile = (failedTasks) => {
    const outputPath = path.join(__dirname, 'failedTasks.json');
    fs.writeFileSync(outputPath, JSON.stringify(failedTasks, null, 2), 'utf-8');
    console.log(`[${new Date().toISOString()}] Failed tasks have been written to ${outputPath}`);
};

// Main function to orchestrate the insertion process
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

    // If mode is 'test', limit to one department and one role
    const departmentsToProcess = mode === 'test' ? [departments[0]] : departments;
    console.log(`[${new Date().toISOString()}] Processing ${departmentsToProcess.length} department(s):`, departmentsToProcess);

    for (const department of departmentsToProcess) {
        console.log(`\n[${new Date().toISOString()}] Processing department: "${department}"`);
        const roles = await getRoles(department);

        if (roles.length === 0) {
            console.warn(`[${new Date().toISOString()}] No roles found for department "${department}". Skipping.`);
            continue;
        }

        // If mode is 'test', limit to one role
        const rolesToProcess = mode === 'test' ? [roles[0]] : roles;
        console.log(`[${new Date().toISOString()}] Found ${rolesToProcess.length} role(s) in department "${department}":`, rolesToProcess);

        for (const role of rolesToProcess) {
            console.log(`[${new Date().toISOString()}] Processing role: "${role}" in department "${department}"`);
            const tasks = await getTasks(department, role);

            if (tasks.length === 0) {
                console.warn(`[${new Date().toISOString()}] No tasks found for role "${role}" in department "${department}". Skipping.`);
                continue;
            }

            // If mode is 'test', limit to one task
            const tasksToProcess = mode === 'test' ? [tasks[0]] : tasks;
            console.log(`[${new Date().toISOString()}] Found ${tasksToProcess.length} task(s) in role "${role}" of department "${department}":`, tasksToProcess);

            for (const task of tasksToProcess) {
                await processTask(department, role, task);

                // Optional: Introduce a small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
        }
    }

    // If there are failed tasks, write them to a JSON file
    if (failedTasks.length > 0) {
        writeFailedTasksToFile(failedTasks);
        console.error(`[${new Date().toISOString()}] Some tasks failed to process. Check 'failedTasks.json' for details.`);
    } else {
        console.log(`[${new Date().toISOString()}] All tasks processed successfully.`);
    }

    console.log(`[${new Date().toISOString()}] Task insertion process completed.`);
};

// Constants and variables
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';
const failedTasks = [];

// Execute the main function
await main();
