// createAssistant1.js
import { createClient } from '@vercel/kv';
import OpenAI from 'openai';  // Import the OpenAI library
import { Assistant } from 'experts';


// Instantiate KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

// Instantiate OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

class MyAssistant extends Assistant {
    constructor(options) {
        super(options);
    }
}

// Hash function to compute SHA-256 hash of the API key
async function hashAPIKey(apiKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// 1. createAssistant function
export default async function createAssistant(assistantId) {
    // Compute the API key hash
    const apiKeyHash = await hashAPIKey(process.env.OPENAI_API_KEY);

    // Check if realAssistantId already exists in the database
    let realAssistantId = await kv.get(`assistant-mapping:${assistantId}:${apiKeyHash}`);

    if (realAssistantId) {
        return realAssistantId;
    } else {
        return await re_createAssistant(assistantId);
    }
}

// 2. re_createAssistant function (Always creates a new assistant)
async function re_createAssistant(assistantId) {
    // Compute the API key hash
    const apiKeyHash = await hashAPIKey(process.env.OPENAI_API_KEY);

    const existingInstructions = await kv.get(`assistant:${assistantId}:instructions`);

    if (!existingInstructions) {
        console.error(`Instructions not found for assistant ID: ${assistantId}`);
        throw new Error(`Instructions not found for assistant ID: ${assistantId}`);
    }

    const instructionsString = typeof existingInstructions === 'object'
        ? JSON.stringify(existingInstructions)
        : String(existingInstructions);

    const maxRetries = 5;
    const retryDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const lockKey = `lock:assistant:${assistantId}:${apiKeyHash}`;
            const lockAcquired = await kv.set(lockKey, 'locked', { nx: true, ex: 30 });

            if (!lockAcquired) {
                console.warn(`Lock not acquired, retrying after ${retryDelay}ms... (Attempt ${attempt + 1})`);
                if (attempt === maxRetries - 1) {
                    console.error(`Failed to acquire lock after ${maxRetries} attempts`);
                    throw new Error('Failed to acquire lock after multiple attempts');
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }

            try {
                // Create a new assistant
                const assistantInstance = await MyAssistant.create({
                    name: `Assistant_${assistantId}`,
                    instructions: instructionsString,
                    model: process.env.GPT_MODEL,
                    temperature: 0.5,
                    apiKey: process.env.OPENAI_API_KEY,
                });

                await assistantInstance.init();
                const newRealAssistantId = assistantInstance.id;

                // Update KV with the new assistant-mapping
                await kv.set(`assistant-mapping:${assistantId}:${apiKeyHash}`, newRealAssistantId);

                return newRealAssistantId;  // Return the newly created assistant ID
            } finally {
                // Release the lock
                await kv.del(lockKey);
            }
        } catch (error) {
            console.error(`Error during attempt ${attempt + 1}:`, error);
            if (attempt === maxRetries - 1) {
                console.error(`Max retries reached. Throwing error.`);
                throw error;  // Rethrow error after max retries
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));  // Retry after delay
        }
    }
}

export { createAssistant, re_createAssistant };
