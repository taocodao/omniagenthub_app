// util/get_role_task_desc.ts

import { createClient } from '@vercel/kv';
import OpenAI from 'openai';
import HashUtil from '../util/hashToFixedDigits'; // Adjust the path as needed
import { acquireLock, releaseLock } from './lock'; // Import the lock utilities

// Initialize the Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Initialize the OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

// Helper function to rephrase task descriptions and limit them to 1000 characters
async function rephraseDescription(description: string): Promise<string> {
    const prompt = `Please create a clear and concise task description for the following, ensuring that the rephrased text does not exceed 1000 characters:

"${description}"

If necessary, summarize the content to fit within the character limit while preserving the key information. Avoid phrases like "As ... your role is ... Task Description: ...".`;

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
            });

            let rephrasedText = response.choices[0]?.message?.content?.trim();

            if (rephrasedText) {
                // Return the rephrased text
                return rephrasedText;
            } else {
                console.warn(`Attempt ${attempt + 1}: Empty response, retrying...`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Attempt ${attempt + 1}: Error rephrasing description:`, error);
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    throw new Error(`Failed to rephrase description after ${maxRetries} attempts.`);
}

// Helper function to summarize role descriptions based on task descriptions
async function summarizeRoleDescription(role: string, department: string, taskDescriptions: string[]): Promise<string> {
    const prompt = `Based on the following task descriptions for the role of ${role} in the ${department} department, summarize the overall role description. The summary should not exceed 1500 characters. Please ensure the key responsibilities and role functions are covered:

"${taskDescriptions.join(' ')}"`;

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
            });

            let summarizedRoleDesc = response.choices[0]?.message?.content?.trim();

            if (summarizedRoleDesc) {
                return summarizedRoleDesc;
            } else {
                console.warn(`Attempt ${attempt + 1}: Empty response, retrying...`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Attempt ${attempt + 1}: Error summarizing role description:`, error);
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    throw new Error(`Failed to summarize role description after ${maxRetries} attempts.`);
}

// Function 1: get_task_desc
/**
 * Retrieves the task description for a specific department, role, and task.
 * If the description does not exist or contains an error, it generates a new one.
 * @param department - The department name.
 * @param role - The role name.
 * @param task - The task name.
 * @returns The task description or an empty string if not found.
 */
export async function get_task_desc(department: string, role: string, task: string): Promise<string> {
    const taskKey = `task_desc:${department}:${role}:${task}`;

    let taskDesc = (await kv.get(taskKey)) as string | null;

    // Check if task description is missing or contains an error message
    if (!taskDesc || taskDesc.includes("Error fetching")) {
        //console.log(`Task description not found or contains error for key ${taskKey}. Generating...`);
        await set_role_task_desc(department, role, task);
        taskDesc = (await kv.get(taskKey)) as string | null;
        //console.log(`Task description after generation found for key ${taskKey}: ${taskDesc}`);
    } else {
        //console.log(`Task description found for key ${taskKey}.`);
    }

    return taskDesc || '';
}

// Function 2: set_role_task_desc
/**
 * Generates and sets the task description for a specific department, role, and task.
 * @param department - The department name.
 * @param role - The role name.
 * @param task - The task name.
 */
export async function set_role_task_desc(department: string, role: string, task: string): Promise<void> {
    try {
        const assistantId = HashUtil.hashTo(`${role}${task}`);
        const instructionKey = `assistant:${assistantId}:instructions`;
        //console.log('Instruction Key:', instructionKey);

        const existingInstructions = await kv.get(instructionKey);
        //console.log('Retrieved Instruction:', existingInstructions);
        //console.log('Type of instruction:', typeof existingInstructions);

        if (!existingInstructions) {
            console.warn(`Instructions not found for assistant ID: ${assistantId}`);
            return;
        }

        const instructionsString =
            typeof existingInstructions === 'object'
                ? JSON.stringify(existingInstructions)
                : String(existingInstructions);

        try {
            const instructionObj = JSON.parse(instructionsString);

            // Use task_description if available, otherwise fallback to 'task'
            const taskDescription = instructionObj.task_description || instructionObj.task;
            if (taskDescription) {
                // Rephrase the task description to ensure clarity and character limit
                const rephrasedDescription = await rephraseDescription(taskDescription);

                // Store the rephrased description in the KV store
                const taskKey = `task_desc:${department}:${role}:${task}`;
                await kv.set(taskKey, rephrasedDescription);
                //console.log(`Set task description for key ${taskKey}.`);
            } else {
                console.warn(`No task_description found in instruction for task ${task}.`);
            }
        } catch (parseError) {
            console.error('Error parsing instruction JSON:', parseError);
        }
    } catch (error) {
        console.error(`Error in set_role_task_desc:`, error);
    }
}

// Function 3: get_role_desc
/**
 * Retrieves the role description for a specific department and role.
 * If the description does not exist or contains an error, it generates a new one.
 * @param department - The department name.
 * @param role - The role name.
 * @returns The role description or an empty string if not found or in progress.
 */
export async function get_role_desc(department: string, role: string): Promise<string> {
    const roleDescKey = `role_desc:${department}:${role}`;

    let roleDesc = (await kv.get(roleDescKey)) as string | null;

    // Check if role description is missing or contains an error message
    if (!roleDesc || roleDesc.includes("Error fetching description")) {
        // console.log(`Role description not found or contains error for key ${roleDescKey}. Generating...`);

        // Define a unique lock key for this department and role
        const lockKey = `lock:role_desc:${department}:${role}`;
        const lockAcquired = await acquireLock(lockKey, 300); // 5 minutes TTL

        if (!lockAcquired) {
            console.warn(`Role description generation already in progress for ${department}:${role}.`);
            return ''; // Alternatively, throw an error or return a specific status
        }

        try {
            // Define the key to fetch the list of tasks for the role
            const roleTasksKey = `department:${department}:role:${role}:tasks`;

            let tasks: string[] = [];

            try {
                const tasksData = await kv.get(roleTasksKey);
                //console.log(`Tasks fetched for key ${roleTasksKey}:`, tasksData);

                if (tasksData === null || tasksData === undefined) {
                    console.warn(`No tasks found for role ${role} in department ${department}.`);
                    return '';
                } else if (Array.isArray(tasksData)) {
                    tasks = tasksData;
                } else if (typeof tasksData === 'string') {
                    try {
                        tasks = JSON.parse(tasksData);
                    } catch (parseError) {
                        console.error(`Error parsing tasks JSON for key ${roleTasksKey}:`, parseError);
                        tasks = [tasksData];
                    }
                } else {
                    console.warn(`Invalid data type for tasksData: ${typeof tasksData}`);
                    return '';
                }
            } catch (error) {
                console.error('Error fetching tasks from KV database:', error);
                return '';
            }

            if (tasks.length === 0) {
                console.warn(`No tasks available for role ${role} in department ${department}.`);
                return '';
            }

            const taskDescriptions: string[] = [];

            for (const task of tasks) {
                // For each task, retrieve its description
                const taskDesc = await get_task_desc(department, role, task);
                if (taskDesc) {
                    taskDescriptions.push(taskDesc);
                } else {
                    console.warn(`No task description found for task ${task} in role ${role} and department ${department}.`);
                }
            }

            if (taskDescriptions.length === 0) {
                console.warn(`No task descriptions found for role ${role} in department ${department}.`);
                return '';
            }

            // Summarize the role description based on all task descriptions
            roleDesc = await summarizeRoleDescription(role, department, taskDescriptions);

            // Store the summarized role description in the KV store
            await kv.set(roleDescKey, roleDesc);
            //console.log(`Set role description for key ${roleDescKey}.`);
        } catch (error) {
            console.error(`Error generating role description for ${department}:${role}:`, error);
            // Optionally, set an error message in the KV store
            await kv.set(roleDescKey, "Error fetching description");
            return '';
        } finally {
            // Release the lock regardless of success or failure
            await releaseLock(lockKey);
            //console.log(`Lock released for key ${lockKey}.`);
        }
    } else {
        //console.log('Role description found for key ', roleDescKey, ' is ', roleDesc);
    }
    return roleDesc || '';
}
