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

const isValidJSON = (str: string) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

// Helper function to create a timeout promise (same as get_role_description)
const timeout = (ms: number) => {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

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

            if (summary && summary.length <= 100) { // Fixed: Changed from 200 to 100
                return summary;
            } else if (summary) {
                return summary.substring(0, 97) + '...'; // Fixed: Changed from 197 to 97
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { department, role, forceRegenerate } = req.body;

    if (!department || !role || typeof department !== 'string' || typeof role !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        // Create a promise for the main processing task
        const processingPromise = (async () => {
            const summaryKey = `role_summary:${department}:${role}`;

            // Check if summary already exists in database (unless force regenerate)
            let existingSummary: string | null = null;
            if (!forceRegenerate) {
                existingSummary = await kv.get(summaryKey);
            }

            if (existingSummary && !forceRegenerate) {
                console.log(`Retrieved cached summary for ${department}:${role}`);
                res.status(200).json({ summary: existingSummary });
                return;
            }

            console.log(`Generating new summary for ${department}:${role}${forceRegenerate ? ' (forced regeneration)' : ''}`);

            // Get the full role description
            const roleDesc = await get_role_desc(department, role);

            if (!roleDesc) {
                res.status(404).json({ error: 'Role description not found' });
                return;
            }

            // Generate summary using OpenAI
            const summary = await generateRoleSummary(role, department, roleDesc);

            // Save the generated summary to database (overwrite if exists)
            await kv.set(summaryKey, summary);
            console.log(`${forceRegenerate ? 'Overwritten' : 'Saved'} summary to database for ${department}:${role}`);

            res.status(200).json({ summary });
        })();

        // Create a timeout promise (14 seconds - same as get_role_description)
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
