// pages/api/cleanup-namespace.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@vercel/kv';
import { kv, scanAllKeys } from '../../utils/redis-helpers';
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index("user-documents"); // Replace with your actual index name



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { userAddress } = req.body;

    if (!userAddress) {
        return res.status(400).json({ message: 'User address is required' });
    }

    try {
        // List all namespaces
        const namespaces = await index.describeIndexStats();
        const userNamespaces = Object.keys(namespaces.namespaces ?? {});


        if (userNamespaces.length === 0) {
            return res.status(404).json({ message: 'No namespaces found for this user address' });
        }

        let deletedNamespaces = [];
        let deletedStatusKeys = [];

        for (const namespace of userNamespaces) {
            // Delete all vectors in the namespace from Pinecone
            await index.namespace(namespace).deleteAll();
            deletedNamespaces.push(namespace);

            // Remove scraped website status info from KV
            try {
                const keys = await scanAllKeys(`lastScrapeVersion:${namespace}:`);
                for (const key of keys) {
                    await (kv as any).delete(key);
                    deletedStatusKeys.push(key);
                }
            } catch (kvError) {
                console.error(`Error listing/deleting scanAllKeys for namespace ${namespace}:`, kvError);
            }
        }

        console.log(`Deleted ${deletedNamespaces.length} namespaces and ${deletedStatusKeys.length} scraped status keys for user ${userAddress}.`);

        return res.status(200).json({
            message: `Deleted ${deletedNamespaces.length} namespaces and ${deletedStatusKeys.length} scraped status keys for user ${userAddress}.`,
            deletedNamespaces,
            deletedStatusKeys
        });
    } catch (error) {
        console.error('Error deleting namespaces:', error);
        return res.status(500).json({
            message: 'Error deleting namespaces.',
            error: (error as Error).message
        });
    }
}
