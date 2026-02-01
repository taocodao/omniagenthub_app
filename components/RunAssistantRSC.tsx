// RunAssistantRSC.tsx
import { createClient } from '@vercel/kv';
import { Assistant, Thread } from 'experts';
import { StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import createAssistant, { re_createAssistant } from './createAssistant1';
import { createStreamableValue, createStreamableUI } from 'ai/rsc';

const KV_REST_API_URL = process.env.KV_REST_API_URL!;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const GPT_MODEL = process.env.GPT_MODEL as OpenAI.ChatCompletionCreateParams['model'];
const LOCK_EXPIRATION_SECONDS = 30;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !OPENAI_API_KEY) {
    throw new Error('Missing required environment variables');
}

const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const ASSISTANT_EXPIRATION_SECONDS = 86400;
const THREAD_EXPIRATION_SECONDS = 86400;
const MAX_LOCK_ATTEMPTS = 5;
const LOCK_RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getOrCreateThread = async (threadId: string | null): Promise<string> => {
    if (!threadId) {
        const newThread = await Thread.create();
        return newThread.id;
    }

    const lockKey = `lock:thread:${threadId}`;
    let lockAcquired = false;
    let attempts = 0;

    while (!lockAcquired && attempts < MAX_LOCK_ATTEMPTS) {
        const result = await kv.set(lockKey, 'locked', { nx: true, ex: LOCK_EXPIRATION_SECONDS });
        lockAcquired = result === 'OK';
        if (!lockAcquired) {
            attempts++;
            await sleep(LOCK_RETRY_DELAY);
        }
    }

    if (!lockAcquired) {
        throw new Error(`Failed to acquire lock after ${MAX_LOCK_ATTEMPTS} attempts`);
    }

    try {
        let realThreadId = await kv.get(`thread-mapping:${threadId}`) as string;

        if (!realThreadId) {
            const newThread = await Thread.create();
            realThreadId = newThread.id;
            await kv.set(`thread-mapping:${threadId}`, realThreadId);
        }

        await kv.expire(`thread:${realThreadId}`, THREAD_EXPIRATION_SECONDS);
        return realThreadId;
    } finally {
        await kv.del(lockKey);
    }
};

export const runAssistant = async (
    assistantId: string,
    threadId: string | null,
    userMessage: string,
    userAddress: string
): Promise<string> => {
    let realThreadId = threadId;
    let hasRetried = false;

    const assistantUserThreadKey = `assistant-user-thread:${assistantId}:${userAddress}`;

    try {
        if (!realThreadId) {
            // Try to get the threadId from the mapping assistantId + userAddress => threadId
            realThreadId = await kv.get<string>(assistantUserThreadKey);
            if (!realThreadId) {
                // Create a new thread
                const thread = await openai.beta.threads.create({});
                realThreadId = thread.id;

                // Update the mapping assistantId + userAddress => threadId
                await kv.set(assistantUserThreadKey, realThreadId, { ex: 86400 * 7 }); // expire in 7 days
            }
        }

        const createdMessage = await openai.beta.threads.messages.create(realThreadId, {
            role: 'user',
            content: userMessage,
        });

        const run = await openai.beta.threads.runs.create(realThreadId, {
            assistant_id: assistantId,
        });

        let runStatus = await openai.beta.threads.runs.retrieve(realThreadId, run.id);
        while (runStatus.status !== 'completed') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(realThreadId, run.id);
        }

        const messages = await openai.beta.threads.messages.list(realThreadId);

        // Safely check for the presence of 'text' in the content
        const assistantMessage = messages.data
            .filter(message => message.role === 'assistant')
            .map(message => {
                const textContent = message.content.find(content => 'text' in content);
                return textContent && 'text' in textContent ? textContent.text?.value : '';
            })
            .join('\n');

        return assistantMessage;

    } catch (error) {
        console.error('Error during assistant run:', error);

        if (!hasRetried) {
            hasRetried = true; // Prevent infinite retries
            try {
                console.log('Retrying with re_createAssistant...');
                const realAssistantId = await re_createAssistant(assistantId);
                if (!realAssistantId) throw new Error('Assistant recreation failed');

                // Create a new thread and update the mapping
                const thread = await openai.beta.threads.create({});
                realThreadId = thread.id;

                // Update the mapping assistantId + userAddress => threadId
                await kv.set(assistantUserThreadKey, realThreadId, { ex: 86400 }); // expire in one day

                const createdMessage = await openai.beta.threads.messages.create(realThreadId, {
                    role: 'user',
                    content: userMessage,
                });

                const run = await openai.beta.threads.runs.create(realThreadId, {
                    assistant_id: realAssistantId,
                });

                let runStatus = await openai.beta.threads.runs.retrieve(realThreadId, run.id);
                while (runStatus.status !== 'completed') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    runStatus = await openai.beta.threads.runs.retrieve(realThreadId, run.id);
                }

                const messages = await openai.beta.threads.messages.list(realThreadId);

                const assistantMessage = messages.data
                    .filter(message => message.role === 'assistant')
                    .map(message => {
                        const textContent = message.content.find(content => 'text' in content);
                        return textContent && 'text' in textContent ? textContent.text?.value : '';
                    })
                    .join('\n');

                return assistantMessage;

            } catch (retryError) {
                console.error('Error during assistant recreation:', retryError);
                throw new Error('Failed during retry');
            }
        }

        throw new Error('Assistant run failed');
    }
};

export const RunAssistantRSC = async ({ assistantId, threadId, userMessage }: { assistantId: string; threadId: string | null; userMessage: string }) => {
    const assistant = await createAssistant(assistantId);
    if (!assistant) {
        throw new Error('Failed to create assistant');
    }
    const realThreadId = await getOrCreateThread(threadId);

    let conversationArray: string[] = [];
    const conversation = await kv.hgetall(`thread:${realThreadId}:conversation`);
    if (conversation) {
        conversationArray = Object.values(conversation) as string[];
    }

    const context = `${conversationArray.join(" ")} ${userMessage}`;
    const response = await assistant.ask(context, realThreadId);

    const stream = new ReadableStream({
        async start(controller) {
            for await (const chunk of response) {
                if (typeof chunk === 'string') {
                    controller.enqueue(new TextEncoder().encode(chunk));
                } else if (typeof chunk === 'object' && chunk !== null) {
                    const chunkObj = chunk as { choices?: { delta?: { content?: string } }[] };
                    const content = chunkObj.choices?.[0]?.delta?.content || '';
                    controller.enqueue(new TextEncoder().encode(content));
                }
            }
            controller.close();
        },
    });

    const timestamp = Date.now();
    await kv.hset(`thread:${realThreadId}:conversation`, {
        [timestamp]: `User: ${userMessage}`,
        [timestamp + 1]: `Assistant: [Streaming Response]`
    });

    return new StreamingTextResponse(stream);
};

export const CleanThreadRSC = async (threadId: string) => {
    await kv.del(`thread-mapping:${threadId}`);
};
