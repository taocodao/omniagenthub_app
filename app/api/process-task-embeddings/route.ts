// app/api/process-task-embeddings/route.ts
import { NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { createClient } from '@vercel/kv';

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface TaskData {
    department: string;
    role: string;
    task: string;
    description: string;
}

interface ProcessingRequest {
    department: string;
    isProductionMode: boolean;
    batchSize: number;
    delayBetweenRequests: number;
    devModeTaskLimit: number;
}

// Function to get task description
async function getTaskDescription(department: string, role: string, task: string): Promise<string> {
    try {
        // First check if description exists in KV store
        const descKey = `task_desc:${department}:${role}:${task}`;
        let description = await kv.get<string>(descKey);

        if (!description) {
            // If not found, try to get it from the task description API
            const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/get_task_description`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department,
                    role,
                    task,
                    language: 'English'
                }),
            });

            if (response.ok) {
                const data = await response.json();
                description = data.description || task; // Fallback to task name
            } else {
                description = task; // Fallback to task name
            }
        }

        return description || task;
    } catch (error) {
        console.error('Error getting task description:', error);
        return task; // Fallback to task name
    }
}

// Function to insert task into embeddings
async function insertTaskIntoEmbedding(taskData: TaskData): Promise<boolean> {
    try {
        // Prepare text for embedding
        const textToEmbed = `${taskData.task}: ${taskData.description}`;

        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: [textToEmbed],
        });

        if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
            throw new Error('Failed to generate embedding');
        }

        const embedding = embeddingResponse.data[0].embedding;

        // Get Pinecone index
        const index = pinecone.index('task-descriptions');

        // Create unique ID
        const taskId = `${taskData.department}-${taskData.role}-${taskData.task}`
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .toLowerCase();

        // Upsert into Pinecone
        await index.upsert([
            {
                id: taskId,
                values: embedding,
                metadata: {
                    department: taskData.department,
                    role: taskData.role,
                    task: taskData.task,
                    description: taskData.description,
                    createdAt: new Date().toISOString()
                }
            }
        ]);

        return true;
    } catch (error) {
        console.error('Error inserting task into embeddings:', error);
        return false;
    }
}

export async function POST(req: NextRequest) {
    const { department, isProductionMode, batchSize, delayBetweenRequests, devModeTaskLimit }: ProcessingRequest = await req.json();

    // Create streaming response with proper controller handling
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                try {
                    const message = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                } catch (error) {
                    console.error('Error sending event:', error);
                }
            };

            try {
                let totalRoles = 0;
                let totalTasks = 0;
                let processedTasks = 0;
                let failedTasks = 0;

                // Step 1: Fetch all roles
                sendEvent({ type: 'log', logType: 'info', message: `Fetching roles from ${department} department...` });

                const rolesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/get-roles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ department }),
                });

                if (!rolesResponse.ok) {
                    throw new Error('Failed to fetch roles');
                }

                const rolesData = await rolesResponse.json();
                const allRoles = Array.isArray(rolesData.roles) ? rolesData.roles : [];

                // Filter out specific roles
                const filteredRoles = allRoles.filter((roleName: string) =>
                    roleName !== "User Research Collector" &&
                    roleName !== "Favorite Task"
                );

                totalRoles = filteredRoles.length;

                sendEvent({
                    type: 'log',
                    logType: 'success',
                    message: `Found ${totalRoles} roles to process`,
                    details: filteredRoles.join(', ')
                });

                // Step 2: Calculate total tasks and collect task data
                const allTasksData: TaskData[] = [];

                for (let i = 0; i < filteredRoles.length; i++) {
                    const role = filteredRoles[i];
                    const isFirstRole = i === 0;

                    // In dev mode, only process first role
                    if (!isProductionMode && !isFirstRole) {
                        sendEvent({
                            type: 'log',
                            logType: 'info',
                            message: `Skipping role: ${role} (dev mode - first role only)`
                        });
                        continue;
                    }

                    sendEvent({
                        type: 'log',
                        logType: 'info',
                        message: `Fetching tasks for role: ${role}`
                    });

                    // Fetch tasks for this role
                    const tasksResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/get-tasks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ department, role }),
                    });

                    if (tasksResponse.ok) {
                        const tasksData = await tasksResponse.json();
                        let tasks = tasksData.tasks || [];

                        // Apply dev mode limit
                        if (!isProductionMode && tasks.length > devModeTaskLimit) {
                            sendEvent({
                                type: 'log',
                                logType: 'warning',
                                message: `Dev mode: Limiting tasks from ${tasks.length} to ${devModeTaskLimit} for role ${role}`
                            });
                            tasks = tasks.slice(0, devModeTaskLimit);
                        }

                        // Collect task data with descriptions
                        for (const task of tasks) {
                            const description = await getTaskDescription(department, role, task);
                            allTasksData.push({
                                department,
                                role,
                                task,
                                description
                            });
                        }

                        totalTasks += tasks.length;
                        sendEvent({
                            type: 'log',
                            logType: 'info',
                            message: `Role ${role}: ${tasks.length} tasks collected`
                        });
                    } else {
                        sendEvent({
                            type: 'log',
                            logType: 'error',
                            message: `Failed to fetch tasks for role: ${role}`
                        });
                    }
                }

                sendEvent({
                    type: 'progress',
                    totalRoles,
                    totalTasks,
                    processedTasks,
                    failedTasks
                });

                sendEvent({
                    type: 'log',
                    logType: 'info',
                    message: `Starting embedding process for ${totalTasks} tasks...`
                });

                // Step 3: Process tasks in batches
                const batch: Promise<boolean>[] = [];

                for (const taskData of allTasksData) {
                    sendEvent({
                        type: 'progress',
                        totalRoles,
                        totalTasks,
                        processedTasks,
                        failedTasks,
                        currentOperation: `Processing: ${taskData.task} (${taskData.role})`
                    });

                    batch.push(insertTaskIntoEmbedding(taskData));

                    if (batch.length >= batchSize) {
                        const results = await Promise.all(batch);
                        const successful = results.filter(r => r).length;
                        const failed = results.filter(r => !r).length;

                        processedTasks += successful;
                        failedTasks += failed;

                        sendEvent({
                            type: 'progress',
                            totalRoles,
                            totalTasks,
                            processedTasks,
                            failedTasks
                        });

                        sendEvent({
                            type: 'log',
                            logType: 'info',
                            message: `Batch completed: ${successful} successful, ${failed} failed`
                        });

                        batch.length = 0; // Clear batch
                        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
                    }
                }

                // Process remaining tasks
                if (batch.length > 0) {
                    const results = await Promise.all(batch);
                    const successful = results.filter(r => r).length;
                    const failed = results.filter(r => !r).length;

                    processedTasks += successful;
                    failedTasks += failed;
                }

                sendEvent({
                    type: 'progress',
                    totalRoles,
                    totalTasks,
                    processedTasks,
                    failedTasks,
                    currentOperation: 'Completed'
                });

                sendEvent({
                    type: 'log',
                    logType: 'success',
                    message: `✅ Task embedding completed! Processed: ${processedTasks}, Failed: ${failedTasks}`
                });

                sendEvent({ type: 'complete' });

            } catch (error) {
                console.error('Error in task embedding process:', error);
                sendEvent({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Unknown error occurred'
                });
            } finally {
                // For ReadableStream, we close the controller properly
                try {
                    controller.close();
                } catch (error) {
                    // Controller might already be closed
                    console.error('Error closing controller:', error);
                }
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
