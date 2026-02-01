import { createClient } from '@vercel/kv';
import createAssistant from '../../components/createAssistant';
import { NextApiRequest, NextApiResponse } from 'next'; // Add this line

// Initialize KV Client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { assistantId, instruction } = req.body;

    if (!assistantId || !instruction) {
        return res.status(400).json({ message: 'Assistant ID and Instruction are required' });
    }

    try {
        const instructionKey = `assistant:${assistantId}:instructions`;
        console.log('Instruction Key:', instructionKey);

        // Update instruction in KV
        await kv.set(instructionKey, instruction);
        console.log('Updated Instruction:', instruction);

        // Attempt to create or update the assistant
        const assistantInstance = await createAssistant(assistantId);

        if (!assistantInstance) {
            return res.status(500).json({ message: 'Failed to create or update assistant' });
        }

        // Respond with success
        return res.status(200).json({ message: 'Instruction updated and assistant created/updated successfully' });
    } catch (error) {
        console.error('Error updating instruction:', error);
        return res.status(500).json({ message: 'Error updating instruction: ' + error });
    }
}
