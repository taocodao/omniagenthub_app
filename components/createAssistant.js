import { createClient } from '@vercel/kv';
import { Assistant } from 'experts';

const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

class MyAssistant extends Assistant {
    constructor(options) {
        super(options);
    }
}

async function createAssistant(assistantId) {
    const existingInstructions = await kv.get(`assistant:${assistantId}:instructions`);

    if (!existingInstructions) {
        throw new Error(`Instructions not found for assistant ID: ${assistantId}`);
    }

    const instructionsString = typeof existingInstructions === 'object'
        ? JSON.stringify(existingInstructions)
        : String(existingInstructions);

    let realAssistantId = await kv.get(`assistant-mapping:${assistantId}`);
    let assistantInstance;

    // If realAssistantId exists, try creating the assistant using it
    if (realAssistantId) {
        try {
            assistantInstance = await MyAssistant.create({
                llm: true,
                id: realAssistantId,
                name: `Assistant_${assistantId}`,
                instructions: instructionsString,
                model: process.env.GPT_MODEL,
                temperature: 0.5,
                apiKey: process.env.OPENAI_API_KEY,
            });
            return assistantInstance;  // Return if successfully created
        } catch (error) {
            console.error('Error retrieving existing assistant with realAssistantId:', error);
            realAssistantId = null;  // Reset to create a new assistant
        }
    }

    // Fall back to creating a new assistant
    const maxRetries = 5;
    const retryDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const lockKey = `lock:assistant:${assistantId}`;
            const lockAcquired = await kv.set(lockKey, 'locked', { nx: true, ex: 30 });

            if (!lockAcquired) {
                console.log(`Lock not acquired, attempt ${attempt + 1} of ${maxRetries}`);
                if (attempt === maxRetries - 1) {
                    throw new Error('Failed to acquire lock after multiple attempts');
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }

            try {
                // Create a new assistant if the previous one failed or realAssistantId was null
                assistantInstance = await MyAssistant.create({
                    name: `Assistant_${assistantId}`,
                    instructions: instructionsString,
                    model: process.env.GPT_MODEL,
                    temperature: 0.5,
                    apiKey: process.env.OPENAI_API_KEY,
                });

                await assistantInstance.init();

                const newRealAssistantId = assistantInstance.id;
                await kv.set(`assistant-mapping:${assistantId}`, newRealAssistantId);  // Save the new mapping

                return assistantInstance;  // Return the newly created assistant
            } finally {
                await kv.del(lockKey);  // Always release the lock
            }
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;  // Re-throw error after max retries
            }
            console.error(`Error during attempt ${attempt + 1}:`, error);
            await new Promise(resolve => setTimeout(resolve, retryDelay));  // Retry after delay
        }
    }
}

export default createAssistant;
