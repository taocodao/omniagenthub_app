//api/get_content_by_language.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import OpenAI from 'openai';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

async function translateDescription(name: string, description: string, language: string): Promise<string> {
    if (language.toLowerCase() === 'english' || language.toLowerCase() === 'en') {
        return description;
    }

    const prompt = `Translate the following text "${description}" to ${language}. Only output the translated text, nothing else. For something like \\n, \${...} just leave it as it is`;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.GPT_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
        });

        const translatedText = response.choices[0]?.message?.content?.trim();
        return translatedText || `Failed to translate to ${language}`;
    } catch (error) {
        console.error(`Error translating to ${language}:`, error);
        return `Failed to translate to ${language}`;
    }
}

/*export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, language } = req.body;

    if (!name || !language || typeof name !== 'string' || typeof language !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        let content = await kv.get(`content:${name}:${language}`);
        if (!content) {
            // If content doesn't exist, use the name as content and translate
            const defaultContent = name;
            const languages = await kv.get('available_languages') as string[];
            if (!languages) {
                return res.status(500).json({ error: 'No languages available' });
            }

            const translations: Record<string, string> = {};
            for (const lang of languages) {
                const translatedContent = await translateDescription(name, defaultContent, lang);
                translations[lang] = translatedContent;
                await kv.set(`content:${name}:${lang}`, translatedContent);
            }

            content = translations[language];
        }
        res.status(200).json({ content: content || null });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}*/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, language } = req.body;

    if (!name || !language || typeof name !== 'string' || typeof language !== 'string') {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        let content = await kv.get<string>(`content:${name}:${language}`);
        if (!content || content.startsWith('Failed to translate to')) {
            // Content is missing or invalid, attempt to translate
            const defaultContent = name; // Use the name as default content
            try {
                const translatedContent = await translateDescription(name, defaultContent, language);
                // Successful translation, cache it
                await kv.set(`content:${name}:${language}`, translatedContent);
                content = translatedContent;
            } catch (translationError) {
                // Translation failed, do not cache the failure
                console.error(`Translation failed for ${name} to ${language}:`, translationError);
                content = defaultContent; // Fallback to default content
            }
        }
        res.status(200).json({ content: content || null });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
