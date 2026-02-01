import { NextApiRequest, NextApiResponse } from 'next';
import { CleanThreadRSC } from '../../components/RunAssistantRSC';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { threadId } = req.body;

    try {
        await CleanThreadRSC(threadId);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error cleaning up thread:', error);
        res.status(500).json({ error: 'Error cleaning up thread' });
    }
};
