// pages/api/perplexity_use_cases.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Gemini Flash (for embeddings)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Initialize Pinecone
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const taskIndex = pinecone.Index('omnisharing');

async function findBestToolMatch(idea: string): Promise<string> {
    try {
        const embedResp = await model.embedContent(idea);
        const vector = embedResp.embedding.values;
        const resp = await taskIndex.query({
            vector,
            topK: 1,
            includeMetadata: true,
            filter: { content: { $exists: true } },
        });

        if (resp.matches && resp.matches.length > 0) {
            const match = resp.matches[0];
            return (match.metadata as any).task || idea;
        }
    } catch (error) {
        console.error('Error finding tool match:', error);
    }
    return idea;
}

import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action = 'get_ideas', query, language = 'en', category, excludeIdeas = [], loadMore = false } = req.body;
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Perplexity API key not configured' });
    }

    try {
        // --- Action: Get Categories ---
        // Categories are hardcoded in frontend now, but keeping this for fallback if needed
        if (action === 'get_categories') {
            return res.status(200).json({ categories: ["Business", "Technology", "Finance", "Marketing", "Education", "Productivity"] });
        }

        // --- Action: Get Ideas (for Category) ---
        if (action === 'get_ideas') {
            if (!category) return res.status(400).json({ error: 'Category is required' });

            // ALWAYS store and retrieve in English
            const cacheKey = `use_cases:ideas:en:${category}`;
            let cachedIdeas: string[] | null = await kv.get(cacheKey) || [];

            let ideasToReturn: string[] = [];
            let needsFetch = false;

            // Decision: Do we use cached ideas or fetch new ones?
            if (loadMore) {
                needsFetch = true;
            } else {
                if (cachedIdeas && cachedIdeas.length >= 5) {
                    ideasToReturn = cachedIdeas.slice(0, 5);
                } else {
                    needsFetch = true;
                }
            }

            if (needsFetch) {
                console.log(`Fetching ideas for ${category} from Perplexity (English)...`);
                // Determine what to exclude (in English)
                const allExcludes = [...(cachedIdeas || []), ...excludeIdeas];

                // Prompt ALWAYS asks for English
                const systemPrompt = `You are a helpful assistant. Generate 5 unique, actionable AI tool use case ideas specifically for the category: "${category}". Generate them in English. Return a JSON object with a key "ideas" containing an array of 5 strings.`;
                const userPrompt = `Generate 5 ideas for ${category}. Do NOT include: ${allExcludes.slice(0, 20).join(', ')}.`;

                const response = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'sonar-pro',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                    }),
                });

                if (!response.ok) throw new Error(`Perplexity API Error: ${response.statusText}`);
                const data = await response.json();
                const contentStr = cleanJson(data.choices[0].message.content);
                const parsed = JSON.parse(contentStr);
                // Clean citations from new ideas (e.g., [1][2])
                const newIdeas = (parsed.ideas || []).map((idea: string) => idea.replace(/\[\d+\]/g, '').trim());

                if (newIdeas.length > 0) {
                    // Append new ideas to English cache
                    const updatedList = [...(cachedIdeas || []), ...newIdeas];
                    const uniqueList = Array.from(new Set(updatedList));
                    await kv.set(cacheKey, uniqueList, { ex: 604800 }); // 7 days

                    ideasToReturn = newIdeas;
                } else {
                    ideasToReturn = [];
                }
            } else {
                // If not fetching new, use the cached slice
                ideasToReturn = cachedIdeas.slice(0, 5);
            }

            // --- TRANSLATION LAYER ---
            // If user language is NOT English, we must translate the ideasToReturn
            if (language && language.toLowerCase() !== 'en' && language.toLowerCase() !== 'english' && ideasToReturn.length > 0) {
                console.log(`Translating ideas to ${language}...`);
                const translationPrompt = `Translate the following array of sentences into ${language}. Return JSON with key "translated_ideas" array. Sentences: ${JSON.stringify(ideasToReturn)}`;

                const transResp = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'sonar-pro',
                        messages: [
                            { role: 'system', content: 'You are a translator. Return valid JSON only.' },
                            { role: 'user', content: translationPrompt }
                        ],
                    }),
                });

                if (transResp.ok) {
                    const transData = await transResp.json();
                    const transContent = cleanJson(transData.choices[0].message.content);
                    try {
                        const transParsed = JSON.parse(transContent);
                        if (transParsed.translated_ideas && Array.isArray(transParsed.translated_ideas)) {
                            ideasToReturn = transParsed.translated_ideas.map((idea: string) => idea.replace(/\[\d+\]/g, '').trim());
                        }
                    } catch (e) {
                        console.error('Translation parse error', e);
                        // Fallback: return English
                    }
                }
            }

            // Map to tools is implicit in the idea text content for this use case
            // (We are sending strings to the frontend)

            return res.status(200).json({ ideas: ideasToReturn });
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

function cleanJson(text: string): string {
    if (text.includes('```json')) {
        return text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
        return text.split('```')[1].split('```')[0].trim();
    }
    return text;
}
