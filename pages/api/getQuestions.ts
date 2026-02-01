import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const KV_REST_API_URL = process.env.KV_REST_API_URL!;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN!;

const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
});

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { threadId } = req.body;

    if (!threadId) {
        res.status(400).json({ error: 'Missing threadId' });
        return;
    }

    try {
        const questions = await kv.get(`questions:${threadId}`);
        //console.log("Questions retrieved from the database are", questions);

        if (Array.isArray(questions) && questions.length > 0) {
            res.status(200).json({ questions });
        } else {
            res.status(200).json({ questions: [] });
        }
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Error fetching questions' });
    }
};
