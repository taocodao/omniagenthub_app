import { NextApiRequest, NextApiResponse } from 'next';

import { runAssistant } from '../../components/RunAssistantRSC';


const KV_REST_API_URL = process.env.KV_REST_API_URL!;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !OPENAI_API_KEY) {
    throw new Error('Missing required environment variables');
}


export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { assistantId, threadId, userMessage, userAddress } = req.body;

    try {
        const response = await runAssistant(assistantId, null, userMessage, userAddress);
        res.status(200).json({ response });
    } catch (error) {
        console.error('Error running assistant:', error);
        res.status(500).json({ error: 'Error running assistant' });
    }
};
