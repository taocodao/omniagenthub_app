// pages/api/get_role_summary_batch.ts

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

interface BatchRoleRequest {
    department: string;
    role: string;
    language: string;
}

interface BatchRoleResponse {
    department: string;
    role: string;
    language: string;
    summary: string;
    cached: boolean;
    error?: string;
}

// Helper function to create a timeout promise
const timeout = (ms: number) => {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

// Generate English role summary from role description (reused from get_role_summary.ts)
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

// Translate English summary to target language (reused from get_role_summary.ts)
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

// Process individual role summary
async function processRoleSummary(request: BatchRoleRequest): Promise<BatchRoleResponse> {
    const { department, role, language } = request;
    const summaryKey = `role_summary:${department}:${role}:${language}`;

    try {
        // First, check if summary exists in database
        const cachedSummary = await kv.get(summaryKey);
        if (cachedSummary && typeof cachedSummary === 'string') {
            console.log(`Retrieved cached summary for ${department}:${role}:${language}`);
            return {
                department,
                role,
                language,
                summary: cachedSummary,
                cached: true
            };
        }

        console.log(`Generating new summary for ${department}:${role}:${language}`);

        // Get the full role description (always in English)
        const roleDesc = await get_role_desc(department, role);
        if (!roleDesc) {
            throw new Error('Role description not found');
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
        console.log(`Saved summary to database for ${department}:${role}:${language}`);

        return {
            department,
            role,
            language,
            summary: finalSummary,
            cached: false
        };

    } catch (error) {
        console.error(`Error processing summary for ${department}:${role}:${language}:`, error);
        const fallbackSummary = `Professional ${role.toLowerCase()} in ${department.toLowerCase()}.`;

        return {
            department,
            role,
            language,
            summary: fallbackSummary,
            cached: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { batch } = req.body;

    if (!batch || !Array.isArray(batch)) {
        return res.status(400).json({ error: 'Invalid batch data. Expected array of {department, role, language} objects.' });
    }

    // Validate batch size (limit to prevent abuse)
    if (batch.length > 50) {
        return res.status(400).json({ error: 'Batch size too large. Maximum 50 requests per batch.' });
    }

    // Validate each request in the batch
    for (const request of batch) {
        if (!request.department || !request.role || !request.language) {
            return res.status(400).json({
                error: 'Invalid request in batch. Each item must have department, role, and language.'
            });
        }
    }

    try {
        console.log(`Processing batch of ${batch.length} role summary requests`);

        // Process requests with timeout protection
        const timeoutDuration = 30000; // 30 seconds timeout for batch
        const processingPromise = Promise.all(
            batch.map(async (request: BatchRoleRequest) => {
                try {
                    return await processRoleSummary(request);
                } catch (error) {
                    return {
                        department: request.department,
                        role: request.role,
                        language: request.language,
                        summary: `Professional ${request.role.toLowerCase()} in ${request.department.toLowerCase()}.`,
                        cached: false,
                        error: error instanceof Error ? error.message : 'Processing failed'
                    };
                }
            })
        );

        const timeoutPromise = timeout(timeoutDuration).then(() => {
            throw new Error('Batch processing timeout');
        });

        const results = await Promise.race([processingPromise, timeoutPromise]) as BatchRoleResponse[];

        // Create mapping for easier frontend consumption
        const summaryMapping: Record<string, string> = {};
        const detailedResults: BatchRoleResponse[] = [];

        results.forEach(result => {
            const key = `${result.department}:${result.role}:${result.language}`;
            summaryMapping[key] = result.summary;
            detailedResults.push(result);
        });

        const successCount = results.filter(r => !r.error).length;
        const cachedCount = results.filter(r => r.cached).length;
        const errorCount = results.filter(r => r.error).length;

        console.log(`Batch completed: ${successCount} successful, ${cachedCount} cached, ${errorCount} errors`);

        res.status(200).json({
            success: true,
            mapping: summaryMapping,
            results: detailedResults,
            stats: {
                total: batch.length,
                successful: successCount,
                cached: cachedCount,
                errors: errorCount
            }
        });

    } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({
            error: 'Batch processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
