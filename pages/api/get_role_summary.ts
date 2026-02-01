// pages/api/get_role_summary.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import OpenAI from 'openai';
import { get_role_desc } from '../../util/get_role_task_desc';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to create a timeout promise
const timeout = (ms: number) => {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

// Generate English role summary from role description
async function generateRoleSummary(role: string, department: string, roleDescription: string): Promise<string> {
    const prompt = `Based on the given role description, create a concise summary that explains what this person actually does in their daily work. The summary must:

1. Be no more than 100 characters including spaces
2. Use plain, everyday language that anyone can understand
3. Focus on the most important 1 core activity or responsibility
4. Don't include "${role}" and "${department}" in generated role description
5. Explain what they DO, not what they are called
6. Use as many characters as possible while staying under the 100 limit
7. Be suitable for display as an image overlay
8. Be extremely brief and to the point

Role Title to avoid: "${role}"
Department to avoid: "${department}"

Role Description to summarize:
"${roleDescription}"

Write only the summary in simple terms. Aim for 90-100 characters to maximize information while staying within limits. Do not use the role title "${role}" or department name "${department}" in your response.`;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.3,
            });

            const summary = response.choices[0]?.message?.content?.trim();
            if (summary && summary.length <= 100) {
                return summary;
            } else if (summary) {
                return summary.substring(0, 97) + '...';
            }

            throw new Error('No valid summary generated');
        } catch (error) {
            attempt++;
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt >= maxRetries) {
                throw new Error('Failed to generate summary after retries');
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    throw new Error('Summary generation failed');
}

// Translate English summary to target language
async function translateRoleSummary(englishSummary: string, targetLanguage: string): Promise<string> {
    if (targetLanguage === 'English') {
        return englishSummary;
    }

    const prompt = `Translate the following English role summary into ${targetLanguage}. 
    
    IMPORTANT REQUIREMENTS:
    1. Keep the translation under 100 characters including spaces
    2. Maintain the same meaning and tone
    3. Use natural, everyday language in ${targetLanguage}
    4. Be as concise as possible while staying accurate
    5. If the translation is too long, abbreviate appropriately while keeping the core meaning
    6. Focus on what the person DOES, not their job title
    7. Use simple, clear language that anyone can understand
    
    English summary to translate:
    "${englishSummary}"
    
    Translate to ${targetLanguage} (max 100 characters):`;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.3,
            });

            const translation = response.choices[0]?.message?.content?.trim();
            if (translation && translation.length <= 100) {
                return translation;
            } else if (translation) {
                return translation.substring(0, 97) + '...';
            }

            throw new Error('No valid translation generated');
        } catch (error) {
            attempt++;
            console.error(`Translation attempt ${attempt} failed:`, error);
            if (attempt >= maxRetries) {
                throw new Error('Failed to translate summary after retries');
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    throw new Error('Translation failed');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { department, role, language = 'English', mode = 'generate', forceRegenerate } = req.body;


    if (!department || !role || typeof department !== 'string' || typeof role !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        const processingPromise = (async () => {
            const summaryKey = `role_summary:${department}:${role}:${language}`;

            // Check if summary already exists in database (unless force regenerate)
            let existingSummary: string | null = null;
            if (!forceRegenerate) {
                const cachedSummary = await kv.get(summaryKey);
                existingSummary = typeof cachedSummary === 'string' ? cachedSummary : null;
            }

            if (existingSummary && !forceRegenerate) {
                console.log(`Retrieved cached summary for ${department}:${role}:${language}`);
                res.status(200).json({ summary: existingSummary });
                return;
            }

            console.log(`Generating new summary for ${department}:${role}:${language}${forceRegenerate ? ' (forced regeneration)' : ''}`);

            // Get the full role description (always in English)
            const roleDesc = await get_role_desc(department, role);
            if (!roleDesc) {
                res.status(404).json({ error: 'Role description not found' });
                return;
            }

            // Generate English summary first
            const englishSummary = await generateRoleSummary(role, department, roleDesc);

            // Save English summary
            const englishSummaryKey = `role_summary:${department}:${role}:English`;
            await kv.set(englishSummaryKey, englishSummary);

            let finalSummary = englishSummary;

            // If target language is not English, translate
            if (language !== 'English') {
                finalSummary = await translateRoleSummary(englishSummary, language);
            }

            // Save the final summary with language-specific key
            await kv.set(summaryKey, finalSummary);
            console.log(`${forceRegenerate ? 'Overwritten' : 'Saved'} summary to database for ${department}:${role}:${language}`);

            res.status(200).json({ summary: finalSummary });
        })();

        // Create a timeout promise (14 seconds)
        const timeoutPromise = timeout(14000).then(() => {
            if (!res.writableEnded) {
                res.status(200).json({
                    message: 'Role summary generation will take some time, Please come back later'
                });
            }
        });

        // Race the processing against the timeout
        await Promise.race([processingPromise, timeoutPromise]);

    } catch (error) {
        console.error('Error generating role summary:', error);
        if (!res.writableEnded) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}


