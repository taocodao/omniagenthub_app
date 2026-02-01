// /pages/api/get-task-alternatives.ts

import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai'; // Import the default export

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { task } = req.body;
    const model = process.env.GPT_MODEL || 'gpt4o-mini'; // Default model

    if (!task) {
        return res.status(400).json({ error: 'Task is required.' });
    }

    try {
        let alternatives: string[] = [];

        if (model.startsWith('gpt-')) {
            // For chat models like 'gpt-3.5-turbo' or 'gpt-4'
            const response = await openai.chat.completions.create({
                model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an assistant that provides concise alternative phrases for tasks.',
                    },
                    {
                        role: 'user',
                        content: `Please provide six alternative phrases for the task: "${task}". Each phrase should be concise and follow title capitalization rules, capitalizing the first letter of each major word except for articles (a, an, the), conjunctions (and, but, or, for, nor), and prepositions (on, at, to, from, by, of, in, with) unless they are the first or last word.`,
                    },
                ],
                temperature: 0.7,
                max_tokens: 150,
            });

            const assistantMessage = response.choices[0]?.message?.content || '';

            // Split and process the assistant's response
            alternatives = assistantMessage
                .split('\n')
                .map((line) => line.replace(/^\d+\.\s*/, '').trim())
                .filter(Boolean)
                .map((phrase) => toTitleCase(phrase));
        } else {
            // For completion models like 'text-davinci-003'
            const response = await openai.completions.create({
                model,
                prompt: `Generate six alternative phrases for the task: "${task}". Each phrase should be concise and follow title capitalization rules, capitalizing the first letter of each major word except for articles (a, an, the), conjunctions (and, but, or, for, nor), and prepositions (on, at, to, from, by, of, in, with) unless they are the first or last word.`,
                max_tokens: 150,
                n: 1,
                temperature: 0.7,
            });

            const completionText = response.choices[0]?.text || '';

            // Split and process the completion text
            alternatives = completionText
                .split('\n')
                .map((line) => line.replace(/^\d+\.\s*/, '').trim())
                .filter(Boolean)
                .map((phrase) => toTitleCase(phrase));
        }

        res.status(200).json({ alternatives });
    } catch (error) {
        console.error('Error with OpenAI API:', error);
        res.status(500).json({ error: 'Failed to generate task alternatives.' });
    }
}

// Helper functions
function toTitleCase(phrase: string): string {
    const minorWords = new Set([
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with'
    ]);

    const words = phrase.split(' ');

    return words
        .map((word, index) => {
            // Remove punctuation for checking
            const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            if (index === 0 || index === words.length - 1) {
                // Always capitalize the first and last word
                return capitalizeWord(word);
            } else if (minorWords.has(cleanWord)) {
                // Lowercase minor words
                return word.toLowerCase();
            } else {
                // Capitalize major words
                return capitalizeWord(word);
            }
        })
        .join(' ');
}

function capitalizeWord(word: string): string {
    if (!word) return '';

    // Check if the word is all uppercase letters (excluding non-letter characters)
    const lettersOnly = word.replace(/[^A-Za-z]/g, '');
    const isAllCaps = lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase();

    // Check if the word is mixed case (e.g., "eBay", "iPhone")
    const isMixedCase = lettersOnly !== lettersOnly.toLowerCase() && lettersOnly !== lettersOnly.toUpperCase();

    if (isAllCaps || isMixedCase) {
        // Preserve the original word if it's an acronym or mixed case
        return word;
    } else {
        // Capitalize first letter, lowercase the rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
}


