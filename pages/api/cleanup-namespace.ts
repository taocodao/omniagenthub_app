// pages/api/cleanup-namespace.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { kv, scanAllKeys } from '../../utils/redis-helpers';

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index("user-documents");


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).json({
            error: `Method ${req.method} Not Allowed`
        });
    }

    const { namespace } = req.body;
    if (!namespace) {
        return res.status(400).json({
            error: 'Missing required namespace parameter in request body'
        });
    }

    let vectorsDeleted = false;
    let kvEntriesRemoved = 0;
    let indexUpdated = false;
    let metadataRemoved = false;

    try {
        // 1. Attempt Pinecone deletion but don't block on failure
        try {
            await index.namespace(namespace).deleteAll();
            vectorsDeleted = true;
        } catch (pineconeError) {
            console.warn('Pinecone deletion warning:', pineconeError);
            vectorsDeleted = false;
        }

        // 2. Always proceed with KV storage cleanup
        try {
            const statusKeys = await scanAllKeys(`lastScrapeVersion:${namespace}:*`);
            for (const key of statusKeys) {
                await kv.del(key);
                kvEntriesRemoved++;
            }
        } catch (kvError) {
            console.error('KV cleanup error:', kvError);
        }

        // 3. Update global index
        try {
            const indexKey = "embeddingIndex1";
            let currentIndex: string[] = [];
            const indexData = await kv.get(indexKey);
            if (indexData) currentIndex = indexData as string[];
            const updatedIndex = currentIndex.filter(key => key !== namespace);
            await kv.set(indexKey, updatedIndex);
            indexUpdated = true;
        } catch (indexError) {
            console.error('Index update error:', indexError);
            indexUpdated = false;
        }

        // 4. Delete metadata with separate error handling
        try {
            await kv.del(`embeddingOwner:${namespace}`);
            await kv.del(`embeddingMapping:${namespace}`);
            metadataRemoved = true;
        } catch (metadataError) {
            console.error('Metadata removal error:', metadataError);
            metadataRemoved = false;
        }

        // Determine overall success
        const partialSuccess = kvEntriesRemoved > 0 || indexUpdated || metadataRemoved;
        const statusCode = partialSuccess ? 200 : 500;

        return res.status(statusCode).json({
            success: partialSuccess,
            message: vectorsDeleted ?
                `Namespace ${namespace} cleaned successfully` :
                `Namespace ${namespace} partially cleaned (database only)`,
            vectorsDeleted,
            kvEntriesRemoved,
            indexUpdated,
            metadataRemoved
        });

    } catch (error) {
        console.error('Unexpected cleanup error:', error);
        return res.status(500).json({
            success: false,
            error: 'Namespace cleanup failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            partialResults: {
                vectorsDeleted,
                kvEntriesRemoved,
                indexUpdated,
                metadataRemoved
            }
        });
    }
}
