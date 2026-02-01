// pages/api/translate.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import OpenAI from 'openai';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!, dangerouslyAllowBrowser: true
});

async function translateDescription(name: string, description: string, fromLanguage: string, toLanguage: string): Promise<string> {

    const prompt = `Translate the following text "${description}" from ${fromLanguage} to ${toLanguage}. Only output the translated text, nothing else. For something like \\n, \${...} just leave it as it is`;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.GPT_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
        });

        const translatedText = response.choices[0]?.message?.content?.trim();

        return translatedText || `Failed to translate to ${toLanguage}`;
    } catch (error) {
        console.error(`Error translating to ${toLanguage}:`, error);
        return `Failed to translate to ${toLanguage}`;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, description, fromLanguage, toLanguage } = req.body;

    if (!name || !description || !fromLanguage || !toLanguage) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        const translatedText = await translateDescription(name, description, fromLanguage, toLanguage);
        res.status(200).json({ translatedText });
    } catch (error) {
        console.error('Error fetching translation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
