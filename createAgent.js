require('dotenv').config({ path: './.env' });
const { OpenAI } = require('openai');
const { createClient } = require('@vercel/kv');
const { id } = require('ethers/lib/utils');

// Initialize Redis client using Vercel KV
const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Log environment variables to ensure they are loaded correctly
console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL);
console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);

// Dynamically import the 'experts' module
(async () => {
    try {
        const { Assistant, Thread } = await import('experts');

        class MyAssistant extends Assistant {
            constructor(options) {
                super(options);
            }
        }

        class MyAssistant extends Assistant {
            constructor(options) {
                super(options);
            }
        }

        const createAssistant = async (assistantId) => {
            const existingInstructions = await kv.get(`assistant:${assistantId}:instructions`);

            if (!existingInstructions) {
                throw new Error(`Instructions not found for assistant ID: ${assistantId}`);
            }

            const instructionsString = typeof existingInstructions === 'object' ? JSON.stringify(existingInstructions) : String(existingInstructions);

            // Check the database mapping assistantId --> realAssistantId
            const realAssistantId = await kv.get(`assistant-mapping:${assistantId}`);

            let assistantInstance;

            if (realAssistantId) {
                // If there is an existing realAssistantId, create the assistant with it
                assistantInstance = await MyAssistant.create({
                    llm: true,
                    id: realAssistantId,
                    name: `Assistant_${assistantId}`,
                    instructions: instructionsString,
                    model: GPT_MODEL,
                    temperature: 0.5,
                    apiKey: OPENAI_API_KEY,
                });
            } else {
                // If there is no existing realAssistantId, create a new assistant
                assistantInstance = await MyAssistant.create({
                    name: `Assistant_${assistantId}`,
                    instructions: instructionsString,
                    model: GPT_MODEL,
                    temperature: 0.5,
                    apiKey: OPENAI_API_KEY,
                });

                await assistantInstance.init();

                const newRealAssistantId = assistantInstance.id;
                // Update the database mapping assistantId --> realAssistantId
                await kv.set(`assistant-mapping:${assistantId}`, newRealAssistantId);
            }


            return assistantInstance;
        };

        const runAssistant = async (assistantId, userMessage) => {
            try {
                // Create or get the assistant
                const assistant = await createAssistant(assistantId);

                // Create a new thread
                const thread = await Thread.create();
                console.log(`Thread created with ID: ${thread.id}`);

                // Ask the assistant a question and get a response
                const response = await assistant.ask(userMessage, thread.id);
                console.log(`Assistant response: ${response}`);

                // Persist conversation in Redis
                await kv.hset(`thread:${thread.id}:conversation`, { userMessage, response });
            } catch (error) {
                console.error('Error running assistant:', error);
            }
        };

        // Example usage
        const assistantId = '6432164280';
        const userMessage = 'create 5 questions';

        await runAssistant(assistantId, userMessage);

        //const assistant = await createAssistant('6432164280')

        //const assistant = await openai.beta.assistants.retrieve("asst_GD6CIj5zwfSiiaDVYHB2Lf22");

        //name = (await assistant).name
        //const thread = await Thread.create();
        //console.log(`Thread created with ID: ${thread.id}`);

        // Ask the assistant a question and get a response
        //const response = await assistant.ask("ask 5 questions", thread.id);

        //console.log(" Response from the retrieve is "), response;

    } catch (error) {
        console.error('Error importing experts module:', error);
    }
})();
