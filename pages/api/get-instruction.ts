import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { assistantId } = req.body;

    if (!assistantId) {
        return res.status(400).json({ message: 'Assistant ID is required' });
    }

    try {
        const instructionKey = `assistant:${assistantId}:instructions`;
        //console.log('Instruction Key:', instructionKey);

        const instruction = await kv.get(instructionKey);
        // console.log('Retrieved Instruction:', instruction);

        if (!instruction) {
            return res.status(404).json({ message: 'Instruction not found' });
        }

        // If instruction is an object, stringify it
        const instructionString = typeof instruction === 'object' ? JSON.stringify(instruction) : instruction;

        return res.status(200).json({ instruction: instructionString });
    } catch (error) {
        console.error('Error retrieving instruction:', error);
        return res.status(500).json({ message: 'Error retrieving instruction: ' + error });
    }
}
