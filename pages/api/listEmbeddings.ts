// pages/api/listEmbeddings.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const userAddress = req.query.userAddress as string;
    if (!userAddress) {
        return res.status(400).json({ error: "Missing userAddress parameter" });
    }

    try {
        // Get all embeddings the user has access to (both owned and shared)
        const [ownedEmbeddings, sharedEmbeddings] = await Promise.all([
            // Get embeddings where user is owner
            kv.get(`selectedSources1:${userAddress}`),
            // Get global embedding index
            kv.get("embeddingIndex1")
        ]);

        // Process owned embeddings
        const ownedKeys = ownedEmbeddings ? (ownedEmbeddings as string[]) : [];

        // Process shared embeddings from global index
        const globalKeys = sharedEmbeddings ? (sharedEmbeddings as string[]) : [];

        // Combine and deduplicate keys
        const allKeys = Array.from(new Set([...ownedKeys, ...globalKeys]));

        if (allKeys.length === 0) {
            return res.status(200).json({ embeddings: [] });
        }

        // Enhanced processing with shared user check
        const items = await Promise.all(
            allKeys.map(async (sourceKey: string) => {
                try {
                    // Get embedding metadata
                    const [mappingData, owner, metadata] = await Promise.all([
                        kv.get(`embeddingMapping:${sourceKey}`),
                        kv.get(`embeddingOwner:${sourceKey}`),
                        kv.get(`${sourceKey}:${userAddress}`)
                    ]);

                    // Get shared users for this embedding (from get.ts pattern)
                    const sharedUsersKey = `selectedSources1:${sourceKey}`;
                    const sharedUsers = await kv.get(sharedUsersKey);

                    return {
                        key: sourceKey,
                        shared: sharedUsers ? (sharedUsers as string[]) : [],
                        owner: owner as string,
                        isOwner: (owner as string).toLowerCase() === userAddress.toLowerCase(),
                        documentName: metadata ? (metadata as any).documentName : undefined,
                        uploadedAt: metadata ? (metadata as any).uploadedAt : undefined,
                        type: metadata ? (metadata as any).type : undefined,
                        // New field to show shared status
                        isShared: sharedUsers
                            ? (sharedUsers as string[]).includes(userAddress)
                            : false
                    };
                } catch (error) {
                    console.error(`Error processing ${sourceKey}:`, error);
                    return null;
                }
            })
        );

        // Filter valid items and apply visibility rules
        const validItems = items.filter(item =>
            item !== null &&
            (item.isOwner || item.isShared)
        );

        res.status(200).json({ embeddings: validItems });
    } catch (error) {
        console.error("Error listing embeddings:", error);
        res.status(500).json({ error: "Error listing embeddings" });
    }
}
