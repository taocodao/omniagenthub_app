// pages/api/guided_discovery.ts
// Multi-turn conversational AI Tool Discovery with heuristic intent classification
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const taskIndex = pinecone.Index('task-descriptions');
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4o-mini';

// Embed text using OpenAI
async function embedText(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
    });
    return response.data[0].embedding;
}

// Search tasks in Pinecone
async function searchTasks(query: string, topK = 4) {
    try {
        const queryEmbedding = await embedText(query);
        const response = await taskIndex.query({
            vector: queryEmbedding,
            topK,
            includeMetadata: true,
        });

        return response.matches?.map(m => ({
            department: (m.metadata as any)?.department || '',
            role: (m.metadata as any)?.role || '',
            task: (m.metadata as any)?.task || '',
            score: m.score ?? 0,
            description: (m.metadata as any)?.description || '',
        })).filter(r => r.task) ?? [];
    } catch (e: any) {
        console.error('[guided_discovery] Search error:', e.message);
        return [];
    }
}

// HEURISTIC INTENT CLASSIFICATION (no separate LLM call)
function classifyIntent(currentQuery: string, previousResults: any[]): 'NEW_SEARCH' | 'FOLLOW_UP' {
    const query = currentQuery.toLowerCase().trim();

    // NEW SEARCH signals: explicit search keywords
    const newSearchPatterns = /^(search|find|show me|what are|tools for|apps for|i want|i need|how to)/i;
    if (newSearchPatterns.test(query)) {
        return 'NEW_SEARCH';
    }

    // FOLLOW-UP signals: pronouns, references, comparisons
    const followUpPatterns = /which one|that one|the first|the second|the third|the fourth|recommend|compare|more about|tell me about|explain|details|best|cheapest|this|these|it|option \d|number \d|\b[1-4]\b/i;
    if (followUpPatterns.test(query) && previousResults.length > 0) {
        return 'FOLLOW_UP';
    }

    // If we have previous results, default to follow-up (safer)
    if (previousResults.length > 0) {
        return 'FOLLOW_UP';
    }

    return 'NEW_SEARCH';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message, chatHistory = [], previousResults = [], language = 'en' } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });

    try {
        console.log(`[guided_discovery] Message: "${message}", Previous results: ${previousResults.length}`);

        // Classify intent using heuristics
        const intent = classifyIntent(message, previousResults);
        console.log(`[guided_discovery] Intent: ${intent}`);

        let results = previousResults;
        let isNewSearch = false;

        // Only perform new search if NEW_SEARCH intent
        if (intent === 'NEW_SEARCH') {
            results = await searchTasks(message, 4);
            isNewSearch = true;

            if (results.length === 0) {
                return res.status(200).json({
                    results: [],
                    analysis: `I couldn't find tools matching "${message}". Try describing your task differently.`,
                    isNewSearch: true
                });
            }
        }

        // Build context for GPT response - include URLs for hyperlinks
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
        const toolsListWithUrls = results.map((r: any, i: number) => {
            const url = `${baseUrl}/ChatHome_bus?selectedRole=${encodeURIComponent(r.role)}&selectedCategory=${encodeURIComponent(r.department)}&selectedTask=${encodeURIComponent(r.task)}`;
            return `${i + 1}. [${r.task}](${url}) (${r.department} → ${r.role})`;
        }).join('\n');

        // Different prompts for new search vs follow-up
        let contextPrompt: string;
        if (isNewSearch) {
            contextPrompt = `User searched for: "${message}"

I found these ${results.length} AI tools (with links):
${toolsListWithUrls}

Write a brief 2-3 sentence analysis:
- What these tools help with
- Recommend which might be best (use the markdown hyperlink format when mentioning tool names)
- Ask one clarifying question`;
        } else {
            // FOLLOW-UP: Answer about previous results
            contextPrompt = `The user is asking a follow-up question about these tools (with links):
${toolsListWithUrls}

User's question: "${message}"

Provide a helpful response. When recommending or mentioning a specific tool, use the markdown hyperlink format [Tool Name](url) so the user can click it directly. Keep it brief (2-3 sentences).`;
        }

        // Determine response language instruction
        const languageInstruction = language && language.toLowerCase() !== 'en' && language.toLowerCase() !== 'english'
            ? `IMPORTANT: Respond entirely in ${language} language. Translate ALL text to ${language}, INCLUDING the display text of hyperlinks (e.g., [translated tool name](url)). Do NOT leave any English text.`
            : '';

        // Build messages with chat history for context
        const contextMessages = [
            { role: 'system' as const, content: `You are a helpful AI tool discovery assistant. Be brief, helpful, and conversational. Always refer to the specific tools shown when answering follow-up questions. ${languageInstruction}` },
            ...chatHistory.slice(-4).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content?.substring(0, 500) || '' })),
            { role: 'user' as const, content: contextPrompt }
        ];

        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: contextMessages,
            max_tokens: 200,
            temperature: 0.7,
        });

        const analysis = completion.choices[0].message?.content ||
            `Which tool interests you? Click a link to try it!`;

        return res.status(200).json({
            results: isNewSearch ? results : [], // Only return results for new searches
            analysis,
            isNewSearch
        });
    } catch (error: any) {
        console.error('[guided_discovery] Error:', error);
        return res.status(200).json({
            results: [],
            analysis: `Error: ${error.message}. Please try again.`,
            isNewSearch: false
        });
    }
}
