// util/openaiHelpers.ts

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Rephrases the given description to ensure clarity and character limit.
 * @param description - The original task description.
 * @returns The rephrased description.
 */
export async function rephraseDescription(description: string): Promise<string> {
    const prompt = `Please create a clear and concise task description for the following, ensuring that the rephrased text does not exceed 1000 characters:

"${description}"

If necessary, summarize the content to fit within the character limit while preserving the key information. Avoid phrases like "As ... your role is ... Task Description: ...".`;

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
            });

            let rephrasedText = response.choices[0]?.message?.content?.trim();

            if (rephrasedText) {
                // Return the rephrased text
                return rephrasedText;
            } else {
                console.warn(`Attempt ${attempt + 1}: Empty response, retrying...`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Attempt ${attempt + 1}: Error rephrasing description:`, error);
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    throw new Error(`Failed to rephrase description after ${maxRetries} attempts.`);
}

/**
 * Summarizes the role description based on task descriptions.
 * @param role - The role name.
 * @param department - The department name.
 * @param taskDescriptions - An array of task descriptions.
 * @returns The summarized role description.
 */
export async function summarizeRoleDescription(role: string, department: string, taskDescriptions: string[]): Promise<string> {
    const prompt = `Based on the following task descriptions for the role of ${role} in the ${department} department, summarize the overall role description. The summary should not exceed 1500 characters. Please ensure the key responsibilities and role functions are covered:

"${taskDescriptions.join(' ')}"`;

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
            });

            let summarizedRoleDesc = response.choices[0]?.message?.content?.trim();

            if (summarizedRoleDesc) {
                return summarizedRoleDesc;
            } else {
                console.warn(`Attempt ${attempt + 1}: Empty response, retrying...`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Attempt ${attempt + 1}: Error summarizing role description:`, error);
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    throw new Error(`Failed to summarize role description after ${maxRetries} attempts.`);
}
