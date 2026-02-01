// pages/api/generateQuestions.ts

import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is stored securely
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const { prompt } = req.body;

    if (!prompt) {
        res.status(400).json({ error: 'Prompt is missing' });
        return;
    }

    try {
        // Use the chat completion method
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Or 'gpt-4' if you have access
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.7,
            n: 1,
        });
        let questionsText;
        if (completion.choices[0].message.content)
            questionsText = completion.choices[0].message.content.trim();

        res.status(200).json({ questions: questionsText });
    } catch (error) {
        console.error('Error generating questions:', error);
        res.status(500).json({ error: 'Error generating questions' });
    }
}
