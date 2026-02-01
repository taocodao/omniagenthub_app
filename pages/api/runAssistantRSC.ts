import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { RunAssistantRSC } from '../../components/RunAssistantRSC';

//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { assistantId, threadId, userMessage } = req.body;

        try {
            const result = await RunAssistantRSC({ assistantId, threadId, userMessage });

            res.status(200).json(result);
        } catch (error) {
            console.error('Error running assistant:', error);
            res.status(500).json({ error: 'Error running assistant' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
