// pages/api/assistant1.ts

import { createAssistant, re_createAssistant } from '../../components/createAssistant1';
import OpenAI from 'openai';
import { createClient } from '@vercel/kv';

export const config = {
    runtime: 'edge', // Ensures this API uses Edge runtime
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function POST(req: Request) {
    let input;
    try {
        //console.log("Parsing request body...");
        input = await req.json();
        //console.log("Received input:", input);
    } catch (error) {
        console.error("Error parsing request JSON:", error);
        return new Response('Invalid JSON in request body', { status: 400 });
    }

    const { threadId: inputThreadId, message, assistantId, userAddress } = input;
    let realAssistantId;

    if (!assistantId) {
        console.error('assistantId is required');
        return new Response('assistantId is required', { status: 400 });
    }

    if (!userAddress) {
        console.error('userAddress is required');
        return new Response('userAddress is required', { status: 400 });
    }

    let threadId = inputThreadId;

    try {
        if (!threadId) {
            //console.log("ThreadId is null, checking assistant-user-thread mapping...");
            const assistantUserThreadKey = `assistant-user-thread:${assistantId}:${userAddress}`;
            threadId = await kv.get<string>(assistantUserThreadKey);
            if (threadId) {
                //console.log(`Found existing threadId ${threadId} for assistantId ${assistantId} and userAddress ${userAddress}`);
            } else {
                //console.log("No existing threadId found, creating a new thread...");
                const thread = await openai.beta.threads.create({});
                threadId = thread.id;
                //console.log("Created new thread with ID:", threadId);

                // Store the mapping assistantId + userAddress => threadId
                await kv.set(assistantUserThreadKey, threadId, { ex: 86400 * 7 }); // expire in 7 days
                //console.log(`Saved assistant-user-thread mapping for assistantId ${assistantId} and userAddress ${userAddress}`);
            }
        } else {
            //console.log("Re-using threadId:", threadId);
        }

        // Ensure assistant is created
        realAssistantId = await createAssistant(assistantId);
        //console.log("Using assistant with ID:", realAssistantId);

        // Create the message
        const createdMessage = await openai.beta.threads.messages.create(
            threadId,
            { role: 'user', content: message },
            { signal: req.signal }
        );
        //console.log("Message created with ID:", createdMessage.id);

        // Optionally, you can run the assistant and stream the response here

        return new Response(
            JSON.stringify({
                threadId,
                assistantId: realAssistantId,
                messageId: createdMessage.id,
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error) {
        console.error("Error during assistant processing:", error);

        try {
            //console.log("Retrying with re_createAssistant...");
            realAssistantId = await re_createAssistant(assistantId);

            // Create the message again
            const createdMessage = await openai.beta.threads.messages.create(
                threadId,
                { role: 'user', content: message },
                { signal: req.signal }
            );
            //console.log("Message re-created with ID:", createdMessage.id);

            return new Response(
                JSON.stringify({
                    threadId,
                    assistantId: realAssistantId,
                    messageId: createdMessage.id,
                }),
                { headers: { 'Content-Type': 'application/json' }, status: 200 }
            );
        } catch (recreateError) {
            console.error("Error running assistant with re_createAssistant:", recreateError);
            return new Response('Error running assistant', { status: 500 });
        }
    }
}
