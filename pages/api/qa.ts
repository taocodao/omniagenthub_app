// pages/api/qa.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { UserQuestions, UserQA, QuestionAnswer } from '../../types';
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

// Hash wallet address to 10-digit numeric key (same as HashUtil.hashTo)
function hashUserKey(input: string): string {
    const trimmedInput = input.trim();
    // Normalize Ethereum addresses to lowercase
    const isEthAddress = /^0x[a-fA-F0-9]{40}$/i.test(trimmedInput);
    const normalizedInput = isEthAddress ? trimmedInput.toLowerCase() : trimmedInput;
    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(normalizedInput).digest('hex');
    // Convert hex to BigInt, then to string and take first 10 digits
    const numericHash = BigInt('0x' + hash).toString();
    return numericHash.slice(0, 10).padEnd(10, '0');
}

// Extend QuestionAnswer type to include saveToTask flag
interface QuestionAnswerExtended extends QuestionAnswer {
    saveToTask?: boolean;
}

// Update interface to include role and task
/*interface UserQuestionsExtended extends UserQuestions {
    role?: string;
    task?: string;
    selectedSources?: string[]; // Add this line
}*/
// Update interface definitions
interface QuestionWithFlag {
    question: string;
    saveToTaskChecked?: boolean;
}

interface UserQuestionsExtended extends UserQuestions {
    role?: string;
    task?: string;
    selectedSources?: string[];
    kbSelectedSources?: string[]; // Knowledge Base source IDs from MCP
    storeName?: string; // MCP notebook name
    useSavedAnswers?: boolean;
    questions: QuestionWithFlag[];
}

// Update interface to include role and task
interface UserQAExtended extends UserQA {
    role?: string;
    task?: string;
    qa: QuestionAnswerExtended[];
    selectedSources?: string[];
    kbSelectedSources?: string[]; // Knowledge Base source IDs for self-learning
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index("user-documents");
const GPT_MODEL = process.env.GPT_MODEL || "gpt-4o-mini";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Placeholder functions for user data storage.
async function updateUserData(userId: string, data: Partial<UserData>): Promise<void> {
    // TODO: Implement updating user data in your database.
}

async function getUserData(userId: string): Promise<UserData> {
    // TODO: Implement retrieval of user data.
    return { lastEmbeddingTimestamp: 0, lastQATimestamp: 0 };
}

interface UserData {
    lastEmbeddingTimestamp: number;
    lastQATimestamp: number;
}

function getNamespace(userId: string, role?: string, task?: string): string {
    return role && task ? `${userId}-${role}-${task}` : userId;
}

/**
 * Embed a given text using OpenAI API.
 */
async function embedText(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
    });

    return response.data[0].embedding;
}

/**
 * Retrieve the selected sources (namespaces) for a given user from KV.
 */
async function getSelectedSources(userId: string): Promise<string[]> {
    const key = `selectedSources1:${userId}`;
    const data = await kv.get(key);
    const sources = data ? (data as string[]) : [];
    console.log(`[qa] Retrieved selected sources for ${userId}: ${JSON.stringify(sources)}`);
    return sources;
}

// Fetch user's selected MCP sources from notebooks (server-side to avoid CORS)
// Uses the /user/source-selection endpoint which stores user's global selection
async function fetchMCPSelectedSources(userWallet: string): Promise<{ sourceIds: string[]; storeName: string }> {
    const MCP_ENDPOINT = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005';
    console.log(`[qa] Fetching MCP sources for wallet: ${userWallet}`);

    try {
        // Use the /user/source-selection endpoint which stores the actual user selection
        const selectionRes = await fetch(`${MCP_ENDPOINT}/user/source-selection`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Wallet-Address': userWallet,
            },
        });

        if (!selectionRes.ok) {
            console.log('[qa] Failed to fetch MCP source selection');
            return { sourceIds: [], storeName: 'default' };
        }

        const selectionData = await selectionRes.json();
        const sourceIds = selectionData.sourceIds || [];
        console.log(`[qa] Found ${sourceIds.length} selected MCP sources for user ${userWallet}`);

        // Get the first notebook name for the store name (needed for query)
        let storeName = 'default';
        try {
            const storesRes = await fetch(`${MCP_ENDPOINT}/tools/list_stores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userWallet }),
            });
            if (storesRes.ok) {
                const storesData = await storesRes.json();
                if (storesData.success && storesData.stores?.length > 0) {
                    storeName = storesData.stores[0].name;
                }
            }
        } catch (e) { /* ignore - storeName is optional fallback */ }

        return { sourceIds, storeName };
    } catch (error) {
        console.error('[qa] Error fetching MCP sources:', error);
        return { sourceIds: [], storeName: 'default' };
    }
}

// Query Knowledge Base MCP server using the same mechanism as the KB chat page
// Uses /tools/query which auto-detects notebook from sourceIds
async function queryKnowledgeBaseStore(
    question: string,
    sourceIds: string[],
    storeName: string = 'default'
): Promise<{ answer: string; queryId?: string; fromCache?: boolean } | null> {
    console.log(`[qa] queryKnowledgeBase called with sourceIds: ${JSON.stringify(sourceIds)}, question: ${question.substring(0, 50)}...`);

    if (!sourceIds || sourceIds.length === 0) {
        console.log('[qa] No sourceIds provided, skipping KB query');
        return null;
    }

    try {
        const MCP_ENDPOINT = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005';
        const ADMIN_BYPASS_KEY = process.env.ADMIN_BYPASS_KEY || process.env.MCP_ADMIN_KEY;

        // Enhance question to request comprehensive, detailed answers
        const enhancedQuestion = `Please provide a COMPREHENSIVE and DETAILED answer to this question, including all relevant context, explanations, and specific details from the documents. Expand on the information where helpful.

Question: ${question}`;

        // Use /tools/query endpoint which auto-detects notebook from sourceIds
        const requestBody = {
            query: enhancedQuestion,
            sourceIds: sourceIds
        };
        console.log(`[qa] Sending KB request to ${MCP_ENDPOINT}/tools/query with admin bypass`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add admin bypass key for server-to-server calls (bypasses X402 payment)
        if (ADMIN_BYPASS_KEY) {
            headers['x-admin-key'] = ADMIN_BYPASS_KEY;
            console.log('[qa] Using admin bypass for MCP query');
        } else {
            console.warn('[qa] No ADMIN_BYPASS_KEY set, MCP query may be blocked by X402');
        }

        const response = await fetch(`${MCP_ENDPOINT}/tools/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            console.log(`[qa] KB query failed with status: ${response.status}`);
            const errorText = await response.text();
            console.log(`[qa] KB error response: ${errorText}`);
            return null;
        }

        const data = await response.json();
        console.log(`[qa] KB response: success=${data.success}, hasResponse=${!!data.response}, queryId: ${data.queryId}`);

        // /tools/query returns { success, response, queryId, fromCache }
        if (data.success && data.response) {
            console.log(`[qa] KB answer retrieved (${data.response.length} chars): ${data.response.substring(0, 200)}...`);
            return {
                answer: data.response,
                queryId: data.queryId,
                fromCache: data.fromCache
            };
        }
        return null;
    } catch (error) {
        console.error('[qa] Error querying Knowledge Base store:', error);
        return null;
    }
}

/**
 * Helper to combine the default user namespace with the selected sources.
 */
function getNamespaces(userId: string, selectedSources: string[]): string[] {
    // Ensure the user's default namespace is included.
    const nsSet = new Set([userId, ...selectedSources]);
    return Array.from(nsSet);
}

/**
 * Insert a QA pair into each namespace.
 * If saveToTask is true, also save to task-specific namespace.
 */

async function deleteVectorIfExists(namespace: string, id: string): Promise<void> {
    try {
        // Query Pinecone to check if the vector exists
        const response = await index.namespace(namespace).query({
            vector: await embedText("dummy"), // Use any dummy embedding
            topK: 1,
            includeMetadata: true,
            filter: { id: { $eq: id } }, // Filter by the exact ID
        });

        if (response.matches && response.matches.length > 0) {
            console.log(`[deleteVectorIfExists] Found vector ${id} in namespace ${namespace}, proceeding with deletion.`);
            await index.namespace(namespace).deleteOne(id);
        } else {
            console.log(`[deleteVectorIfExists] Vector ${id} does not exist in namespace ${namespace}, skipping deletion.`);
        }
    } catch (error) {
        console.error(`[deleteVectorIfExists] Error checking/deleting vector ${id}:`, error);
        throw error;
    }
}


/*async function insertQA(
    userId: string,
    qa: QuestionAnswerExtended,
    selectedSources?: string[],
    role?: string,
    task?: string,
    saveToTask?: boolean
): Promise<void> {
    const questionEmbedding = await embedText(qa.question);
    const id = `${userId}-${Buffer.from(qa.question).toString('base64')}`;
    const timestamp = Date.now();

    const userNamespace = getNamespace(userId);


    if (saveToTask) {
        // Save edited QA pair in user's personal namespace
        console.log('Inside SaveToTask is true: Inserting QA pair:', { userId, role, task, selectedSources });
        await index.namespace(userNamespace).upsert([{
            id,
            values: questionEmbedding,
            metadata: {
                question: qa.question,
                answer: qa.answer,
                isEditedQA: true,
                timestamp,
                role: role ?? '',
                task: task ?? '',
                selectedSources: selectedSources ?? [],
            },
        }]);

        // Save question to task-specific list
        if (role && task) {
            const taskNamespace = `${userId}-${role}-${task}`;
            const savedQuestionsKey = `savedQuestions:${taskNamespace}`;
            let savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

            if (!savedQuestions.includes(qa.question)) {
                savedQuestions.push(qa.question);
                await kv.set(savedQuestionsKey, savedQuestions);
            }
        }
    } else {
        console.log('Inside SaveToTask is false: Inserting QA pair:', { userId, role, task, selectedSources });
        // Delete QA pair from user's namespace only if it exists
        await deleteVectorIfExists(userNamespace, id);

        // Remove question from task-specific list
        if (role && task) {
            const taskNamespace = getNamespace(userId, role, task);
            const savedQuestionsKey = `savedQuestions:${taskNamespace}`;
            let savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

            if (savedQuestions.includes(qa.question)) {
                savedQuestions = savedQuestions.filter((q) => q !== qa.question);
                await kv.set(savedQuestionsKey, savedQuestions);
            }
        }
    }
}*/

async function insertQA(
    userId: string,
    qa: QuestionAnswerExtended,
    selectedSources?: string[],
    role?: string,
    task?: string,
    saveToTask?: boolean,
    kbSelectedSources?: string[]
): Promise<void> {
    const questionEmbedding = await embedText(qa.question);
    const id = `${userId}-${Buffer.from(qa.question).toString('base64')}`;
    const timestamp = Date.now();

    const userNamespace = `${userId}`;

    if (saveToTask) {
        // Save edited QA pair in user's personal namespace
        console.log('Saving QA pair:', { userId, question: qa.question, saveToTask, kbSources: kbSelectedSources?.length || 0 });
        await index.namespace(userNamespace).upsert([{
            id,
            values: questionEmbedding,
            metadata: {
                question: qa.question,
                answer: qa.answer,
                isEditedQA: true,
                timestamp,
                role: role ?? '',
                task: task ?? '',
                selectedSources: selectedSources ?? [],
                kbSelectedSources: kbSelectedSources ?? [], // Store KB sources for source-tied learning
            },
        }]);

        // Save question to task-specific list with correct key format
        if (role && task) {
            const selectedSourcesStr = selectedSources ? selectedSources.join('-') : '';
            const savedQuestionsKey = `savedQuestions:${userId}-${role}-${task}-${selectedSourcesStr}`;

            let savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

            if (!savedQuestions.includes(qa.question)) {
                savedQuestions.push(qa.question);
                await kv.set(savedQuestionsKey, savedQuestions);
                console.log(`Added question to saved list: ${savedQuestionsKey}`);
            }
        }
    } else {
        // Remove QA pair from user's namespace
        await deleteVectorIfExists(userNamespace, id);

        // Remove question from task-specific list
        if (role && task) {
            const selectedSourcesStr = selectedSources ? selectedSources.join('-') : '';
            const savedQuestionsKey = `savedQuestions:${userId}-${role}-${task}-${selectedSourcesStr}`;

            let savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

            if (savedQuestions.includes(qa.question)) {
                savedQuestions = savedQuestions.filter((q) => q !== qa.question);
                await kv.set(savedQuestionsKey, savedQuestions);
                console.log(`Removed question from saved list: ${savedQuestionsKey}`);
            }
        }
    }
}



/**
 * Insert a document embedding in the default user namespace.
 */
async function insertDocumentEmbedding(userId: string, content: string): Promise<void> {
    const contentEmbedding = await embedText(content);
    const id = `doc-${userId}-${Buffer.from(content).toString('base64')}`;
    const timestamp = Date.now();

    await index.namespace(userId).upsert([{
        id,
        values: contentEmbedding,
        metadata: {
            content,
            timestamp,
        },
    }]);

    await updateUserData(userId, { lastEmbeddingTimestamp: timestamp });
}

/**
 * Check if new embeddings have been added since the last QA.
 */
async function checkForNewEmbeddings(userId: string): Promise<boolean> {
    const userData = await getUserData(userId);
    return userData.lastEmbeddingTimestamp > userData.lastQATimestamp;
}

/**
 * Query multiple namespaces to fetch updated context.
 */
async function fetchUpdatedContextFromNamespaces(namespaces: string[], questionEmbedding: number[]): Promise<string> {
    let allMatches: any[] = [];

    for (const ns of namespaces) {
        try {
            const response = await index.namespace(ns).query({
                vector: questionEmbedding,
                topK: 20,
                includeMetadata: true,
                filter: { content: { $exists: true } },
            });

            if (response.matches) {
                allMatches.push(...response.matches);
            }
        } catch (error) {
            console.error(`[qa] Error querying namespace ${ns}:`, error);
            // Continue with other namespaces if one fails
        }
    }

    console.log(`[qa] Total matches from namespaces ${JSON.stringify(namespaces)}: ${allMatches.length}`);

    // Group matches by source (if available)
    const grouped: { [source: string]: any[] } = {};
    for (const match of allMatches) {
        const meta = match.metadata as any;
        if (meta.source) {
            if (!grouped[meta.source]) grouped[meta.source] = [];
            grouped[meta.source].push(match);
        }
    }

    let selectedMatches: any[] = [];
    for (const source in grouped) {
        const matches = grouped[source];
        if (matches.some(m => (m.metadata as any).version !== undefined)) {
            const maxVersion = Math.max(...matches.map(m => (m.metadata as any).version));
            selectedMatches = selectedMatches.concat(matches.filter(m => (m.metadata as any).version === maxVersion));
        } else {
            selectedMatches = selectedMatches.concat(matches);
        }
    }

    const context = selectedMatches.map(match => (match.metadata as any).content).join("\n");
    console.log(`[qa] Combined context length: ${context.length}`);

    return context;
}

/**
 * Retrieve a cached QA pair from namespaces.
 * Check task-specific namespace first if role and task are provided.
 */
/*async function retrieveQA(
    userId: string,
    question: string,
    selectedSources: string[],
    role?: string,
    task?: string
): Promise<QuestionAnswer> {

    // Check user's personal namespace first
    const userNamespace = `${userId}`;
    const userResponse = await index.namespace(userNamespace).query({
        vector: await embedText(question),
        topK: 1,
        includeMetadata: true
    });

    if (userResponse.matches?.length) {
        const match = userResponse.matches[0];
        if (match.metadata) {
            return {
                question: String(match.metadata.question),
                answer: String(match.metadata.answer),
                saveToTaskChecked: true
            };
        }
    }


    if (role && task) {
        const taskNamespace = getNamespace(userId, role, task);
        // Check if explicitly saved question exists first
        const savedQuestionsKey = `savedQuestions:${taskNamespace}`;
        const savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

        if (savedQuestions.includes(question)) {
            // Retrieve from task-specific namespace directly:
            const response = await index.namespace(taskNamespace).query({
                vector: await embedText(question),
                topK: 1,
                includeMetadata: true
            });

            if (response.matches?.length) {
                const match = response.matches[0];
                if (match.metadata) {
                    return {
                        question: String(match.metadata.question),
                        answer: String(match.metadata.answer),
                        saveToTaskChecked: true // indicate checkbox pre-checked frontend
                    };
                }
            }
        }
    }

    // If no explicit match found, dynamically generate new answer from current embeddings:
    const namespaces = getNamespaces(userId, selectedSources);
    const context = await fetchUpdatedContextFromNamespaces(namespaces, await embedText(question));
    const answer = await generateAnswer(question, context);

    return { question, answer };
}*/

/*async function retrieveQA(
    userId: string,
    question: string,
    selectedSources: string[],
    role?: string,
    task?: string
): Promise<QuestionAnswer> {
    // Check user's personal namespace first
    const userNamespace = `${userId}`;
    const userResponse = await index.namespace(userNamespace).query({
        vector: await embedText(question),
        topK: 1,
        includeMetadata: true
    });

    if (userResponse.matches?.length) {
        const match = userResponse.matches[0];
        if (match.metadata) {
            return {
                question: String(match.metadata.question),
                answer: String(match.metadata.answer),
                saveToTaskChecked: true
            };
        }
    }

    if (role && task) {
        // Use correct key format with selectedSources
        const selectedSourcesStr = selectedSources ? selectedSources.join('-') : '';
        const savedQuestionsKey = `savedQuestions:${userId}-${role}-${task}-${selectedSourcesStr}`;

        // Check if explicitly saved question exists
        const savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

        if (savedQuestions.includes(question)) {
            // Retrieve from task-specific namespace
            const taskNamespace = `${userId}-${role}-${task}`;
            const response = await index.namespace(taskNamespace).query({
                vector: await embedText(question),
                topK: 1,
                includeMetadata: true
            });

            if (response.matches?.length) {
                const match = response.matches[0];
                if (match.metadata) {
                    return {
                        question: String(match.metadata.question),
                        answer: String(match.metadata.answer),
                        saveToTaskChecked: true
                    };
                }
            }
        }
    }

    // Generate new answer for unsaved questions
    const namespaces = getNamespaces(userId, selectedSources);
    const context = await fetchUpdatedContextFromNamespaces(namespaces, await embedText(question));
    const answer = await generateAnswer(question, context);

    return { question, answer };
} */

async function retrieveQA(
    userId: string,
    question: string,
    selectedSources: string[],
    role?: string,
    task?: string,
    kbSelectedSources?: string[]
): Promise<QuestionAnswer> {
    // For consistency, check if this is a saved question
    if (role && task) {
        const selectedSourcesStr = selectedSources ? selectedSources.join('-') : '';
        const savedQuestionsKey = `savedQuestions:${userId}-${role}-${task}-${selectedSourcesStr}`;
        const savedQuestions = await kv.get(savedQuestionsKey) as string[] || [];

        if (savedQuestions.includes(question)) {
            // This is a saved question, try to get the saved answer
            const userNamespace = `${userId}`;
            const response = await index.namespace(userNamespace).query({
                vector: await embedText(question),
                topK: 1,
                includeMetadata: true
            });

            if (response.matches?.length) {
                const match = response.matches[0];
                if (match.metadata) {
                    return {
                        question: String(match.metadata.question),
                        answer: String(match.metadata.answer),
                        saveToTaskChecked: true
                    };
                }
            }
        }
    }

    // Fetch MCP sources server-side if not provided by client (CORS may block client-side fetch)
    let mcpSourceIds = kbSelectedSources || [];
    let mcpStoreName = 'default';

    if (mcpSourceIds.length === 0) {
        console.log(`[qa] No KB sources passed from client, fetching server-side for user ${userId}`);
        const mcpSources = await fetchMCPSelectedSources(userId);
        mcpSourceIds = mcpSources.sourceIds;
        mcpStoreName = mcpSources.storeName;
    }

    // If KB sources are available, use iterative RAG approach
    if (mcpSourceIds.length > 0) {
        console.log(`[qa] Querying KB with ${mcpSourceIds.length} source IDs using iterative approach`);
        const ragResult = await iterativeRAGQuery(question, mcpSourceIds, mcpStoreName);

        if (ragResult.answer) {
            console.log(`[qa] Got answer for question (iterative=${ragResult.usedIterative}): ${question}`);
            // Strip inline citations like [filename.pdf] or [Source Name] for cleaner output
            const cleanAnswer = ragResult.answer
                .replace(/\s*\[[^\]]+\.(pdf|docx?|pptx?|txt|csv|xlsx?)\]/gi, '')  // Remove [file.ext] citations
                .replace(/\s*\[OmniAgentHub[^\]]*\]/gi, '')  // Remove OmniAgentHub citations specifically
                .replace(/\s*\[Source:[^\]]+\]/gi, '')  // Remove [Source: ...] citations
                .replace(/\s+([.,;:])/g, '$1')  // Clean up spaces before punctuation
                .trim();
            return {
                question,
                answer: cleanAnswer,
            };
        }
    }

    // Fallback: Generate new answer using Pinecone context if no KB sources or KB failed
    const namespaces = getNamespaces(userId, selectedSources);
    let context = await fetchUpdatedContextFromNamespaces(namespaces, await embedText(question));

    const answer = await generateAnswer(question, context);

    return { question, answer };
}



/**
 * Detect if an answer is incomplete or indicates the information wasn't found.
 */
function detectIncompleteAnswer(answer: string): boolean {
    if (!answer || answer.length < 20) return true;

    const incompletePatterns = [
        /(?:cannot|could not|can't) find (?:this )?information/i,
        /not (?:found|find) (?:this )?information in/i,
        /information (?:is )?not (?:available|found)/i,
        /I (?:don't|do not|couldn't|could not) have (?:enough )?information/i,
        /please (?:provide|edit this answer|specify)/i,
        /I would need (?:some )?specific information/i,
        /no relevant (?:information|data|content) (?:was )?found/i,
        /this information was not found/i,
        /provide more specific source documents/i,
    ];

    return incompletePatterns.some(pattern => pattern.test(answer));
}

/**
 * Generate sub-questions to decompose a complex question into answerable parts.
 */
async function generateSubQuestions(originalQuestion: string): Promise<string[]> {
    console.log(`[qa] Generating sub-questions for: ${originalQuestion}`);

    const prompt = `Given this question that a RAG system could not answer directly:
"${originalQuestion}"

Generate 3-5 simpler, more specific sub-questions that could help gather the necessary information to answer the original question. These should be questions that are more likely to match content in business documents.

For example, if the question is "What industry is the person you're trying to connect with?", generate questions like:
- What is the company name mentioned in the documents?
- What products or services does the company offer?
- Who is the target audience?

Return ONLY the questions, one per line, no numbering or bullets.`;

    try {
        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant that breaks down complex questions into simpler, more specific sub-questions." },
                { role: "user", content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.3,
        });

        const response = completion.choices[0].message?.content || '';
        const subQuestions = response
            .split('\n')
            .map(q => q.trim())
            .filter(q => q.length > 10 && q.endsWith('?'))
            .slice(0, 5);

        console.log(`[qa] Generated ${subQuestions.length} sub-questions`);
        return subQuestions;
    } catch (error) {
        console.error('[qa] Error generating sub-questions:', error);
        return [];
    }
}

/**
 * Synthesize a comprehensive answer from multiple sub-question answers.
 */
async function synthesizeAnswerFromSubQuestions(
    originalQuestion: string,
    subQAs: { question: string; answer: string }[]
): Promise<string> {
    console.log(`[qa] Synthesizing answer from ${subQAs.length} sub-question answers`);

    const subQAText = subQAs
        .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
        .join('\n\n');

    const prompt = `Original Question: "${originalQuestion}"

I gathered the following information from related sub-questions:

${subQAText}

Based on the above information, provide a comprehensive, well-structured answer to the original question. 
- Use the actual data found (company names, products, audiences, etc.)
- Format the answer clearly with bullet points or sections where appropriate
- If some information was not found, note what specific information is still needed
- DO NOT use placeholder text like "[insert X]"`;

    try {
        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant that synthesizes information from multiple sources into comprehensive answers." },
                { role: "user", content: prompt },
            ],
            max_tokens: 1000,
            temperature: 0.4,
        });

        const synthesizedAnswer = completion.choices[0].message?.content || '';
        console.log(`[qa] Synthesized answer: ${synthesizedAnswer.substring(0, 100)}...`);
        return synthesizedAnswer.trim();
    } catch (error) {
        console.error('[qa] Error synthesizing answer:', error);
        // Fallback: just combine the sub-answers
        return subQAs.map(qa => `**${qa.question}**\n${qa.answer}`).join('\n\n');
    }
}

/**
 * Perform iterative RAG query: if initial answer is incomplete, use sub-questions.
 */
async function iterativeRAGQuery(
    question: string,
    sourceIds: string[],
    storeName: string
): Promise<{ answer: string; usedIterative: boolean }> {
    // First attempt: direct query
    const directResult = await queryKnowledgeBaseStore(question, sourceIds, storeName);
    const directAnswer = directResult?.answer || '';

    // Check if answer is complete
    if (directAnswer && !detectIncompleteAnswer(directAnswer)) {
        return { answer: directAnswer, usedIterative: false };
    }

    console.log(`[qa] Initial answer incomplete, trying iterative approach...`);

    // Generate sub-questions
    const subQuestions = await generateSubQuestions(question);
    if (subQuestions.length === 0) {
        return { answer: directAnswer || 'Unable to find relevant information in the selected sources.', usedIterative: false };
    }

    // Query each sub-question
    const subQAs: { question: string; answer: string }[] = [];
    for (const subQ of subQuestions) {
        const subResult = await queryKnowledgeBaseStore(subQ, sourceIds, storeName);
        if (subResult?.answer && !detectIncompleteAnswer(subResult.answer)) {
            subQAs.push({ question: subQ, answer: subResult.answer });
            console.log(`[qa] Sub-question "${subQ.substring(0, 30)}..." got valid answer`);
        }
    }

    // If we got valid answers from sub-questions, synthesize
    if (subQAs.length > 0) {
        const synthesized = await synthesizeAnswerFromSubQuestions(question, subQAs);
        return { answer: synthesized, usedIterative: true };
    }

    // No valid sub-answers found
    return {
        answer: directAnswer || 'I could not find this information in the provided sources. Please edit this answer or provide more specific source documents.',
        usedIterative: false
    };
}

/**
 * Generate an answer using GPT.
 */
async function generateAnswer(question: string, context: string): Promise<string> {
    console.log(`[qa] Generating answer for: "${question}" with context length: ${context.length} chars`);

    // If we have KB context, use a more specific prompt
    const hasKBContext = context.includes('[Knowledge Base Context]') || context.length > 100;

    const systemPrompt = hasKBContext
        ? `You are a helpful business assistant answering questions based on the user's actual business documents and knowledge base.

CRITICAL INSTRUCTIONS:
- Provide COMPREHENSIVE and DETAILED answers using specific information from the provided context
- Extract ACTUAL company names, products, services, target audiences, and details from the context
- NEVER use placeholder text like "[insert your product/service]" or "[specific demographics]"
- If the context mentions a specific company, product, or target audience, USE THOSE EXACT DETAILS
- Expand on the information - provide context, explanations, and elaboration
- DO NOT cite or mention source names in your answer - just use the information naturally
- Format your answer using markdown for better readability (bold headers, bullet points, etc.)
- If the information is NOT available in the provided sources, clearly state:
  "This information was not found in your selected sources. Please edit this answer to provide: [what specific info is needed]"`
        : `You are a helpful business assistant. The user has not selected any knowledge base sources.

INSTRUCTIONS:
- Ask the user to select sources from their Knowledge Base for more accurate answers
- OR ask them to provide the specific information directly in their answer
- Provide a comprehensive template showing what information is needed
- Example: "Please provide your [company name], [main products/services], and [target audience]"`;

    const prompt = `Context from business documents:
${context}

Question: ${question}

Answer (provide a comprehensive, detailed answer using the context above - NO placeholders, NO source citations):`;

    const completion = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ],
        max_tokens: 1000, // Increased for more comprehensive answers
        temperature: 0.4,
    });

    const answer = completion.choices[0].message?.content;
    console.log(`[qa] Generated answer (${hasKBContext ? 'with KB context' : 'no KB context'}): ${answer?.substring(0, 100)}...`);

    return answer ? answer.trim() : "Sorry, I couldn't generate an answer.";
}

/**
 * Helper to get standardized namespace for a user, optionally with role and task.
 */



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const body = req.body as any;

        /*if ("questions" in body) {
            const userQuestions = body as UserQuestionsExtended;

            const answers: QuestionAnswer[] = await Promise.all(
                userQuestions.questions.map(async (question) => {
                    // Pass role and task to retrieveQA
                    const qa = await retrieveQA(
                        userQuestions.userId,
                        question.question,
                        userQuestions.role,
                        userQuestions.task
                    );

                    if (qa) return qa;

                    // Fallback: If no cached answer is found, generate one using the default namespace.
                    const contextEmbedding = await embedText(question.question);
                    const context = await fetchUpdatedContextFromNamespaces([userQuestions.userId], contextEmbedding);
                    const answer = await generateAnswer(question.question, context);
                    return { question: question.question, answer };
                })
            );

            return res.status(200).json({ userId: userQuestions.userId, qa: answers });
        }*/
        /*if ("questions" in body) {
            const userQuestions = body as UserQuestionsExtended;

            // Use explicitly passed selected sources or fetch current ones
            const selectedSources =
                userQuestions.selectedSources || (await getSelectedSources(userQuestions.userId));

            const answers = await Promise.all(
                userQuestions.questions.map(async (question) => {
                    return retrieveQA(
                        userQuestions.userId,
                        question.question,
                        selectedSources,
                        userQuestions.role,
                        userQuestions.task
                    );
                })
            );

            return res.status(200).json({ userId: userQuestions.userId, qa: answers });
        }*/
        // Update the handler for "questions" in body
        if ("questions" in body) {
            const userQuestions = body as UserQuestionsExtended;

            // Use explicitly passed selected sources or fetch current ones
            const selectedSources =
                userQuestions.selectedSources || (await getSelectedSources(userQuestions.userId));

            const answers = await Promise.all(
                userQuestions.questions.map(async (questionObj) => {
                    const questionText = questionObj.question;
                    const isSavedQuestion = questionObj.saveToTaskChecked === true;

                    // If this is a saved question and we should use saved answers
                    if (isSavedQuestion && userQuestions.useSavedAnswers) {
                        // Check user's personal namespace for saved answer
                        const userNamespace = `${userQuestions.userId}`;

                        try {
                            const response = await index.namespace(userNamespace).query({
                                vector: await embedText(questionText),
                                topK: 1,
                                includeMetadata: true
                            });

                            if (response.matches?.length) {
                                const match = response.matches[0];
                                if (match.metadata) {
                                    // Found a saved answer
                                    console.log(`Using saved answer for question: ${questionText}`);
                                    return {
                                        question: questionText,
                                        answer: String(match.metadata.answer),
                                        saveToTaskChecked: true
                                    };
                                }
                            }
                        } catch (error) {
                            console.error(`Error retrieving saved answer for ${questionText}:`, error);
                            // Continue to generate a new answer if there's an error
                        }
                    }

                    // For new questions or if saved answer wasn't found, generate a new answer
                    return retrieveQA(
                        userQuestions.userId,
                        questionText,
                        selectedSources,
                        userQuestions.role,
                        userQuestions.task,
                        userQuestions.kbSelectedSources // Pass KB sources for context
                    );
                })
            );

            return res.status(200).json({ userId: userQuestions.userId, qa: answers });
        }
        else if ("qa" in body) {
            const userQA = body as UserQAExtended;
            const fetchedSources = await getSelectedSources(userQA.userId);

            // Insert each QA pair, respecting the saveToTask flag
            for (const qa of userQA.qa) {
                await insertQA(
                    userQA.userId,
                    qa,
                    userQA.selectedSources || fetchedSources,
                    userQA.role,
                    userQA.task,
                    qa.saveToTask,
                    userQA.kbSelectedSources // Pass KB sources for source-tied learning
                );
                console.log('Processing QA pair:', { question: qa.question, saveToTask: qa.saveToTask, kbSources: userQA.kbSelectedSources?.length || 0 });

            }

            return res.status(200).json({ message: "QA pairs inserted successfully" });
        } else {
            return res.status(400).json({ message: "Invalid request body" });
        }
    } catch (error) {
        console.error('[qa] Error processing request:', error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
