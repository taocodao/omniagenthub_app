// pages/api/uploadFile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";
import { createAndStoreEmbeddings } from "../../utils/embeddings";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Check for account id in either "accountid" or "user-address" header (case-insensitive)
    const headerUserId =
        (req.headers["accountid"] as string) ||
        (req.headers["user-address"] as string) ||
        "anonymous";

    const userId = headerUserId; // Use the detected userId

    // Expect a document name, text content, and an optional sharedUserIds array.
    const { name, text, sharedUserIds } = req.body as { name: string; text: string; sharedUserIds?: string[] };

    if (!name || !text) {
        return res.status(400).json({ error: 'Missing "name" or "text" in request body.' });
    }

    // Immediately respond to avoid timeout.
    res.status(200).json({ message: "Upload initiated. Embeddings will be updated when complete." });

    // Merge the uploader's userId with any sharedUserIds provided.
    const initialShared: string[] = Array.from(new Set([userId, ...(sharedUserIds || [])]));
    // For logging purposes we record a version timestamp; for uploads version is passed but will be used only for logging.
    const version = Date.now();
    // Use composite key: "upload:{name.trim()}"
    const sourceKey = `upload:${name.trim()}`;

    // Create and store embeddings.
    await Promise.all(
        initialShared.map(async (uid) => {
            await createAndStoreEmbeddings(uid, sourceKey, text, version, false);
        })
    );

    // Update metadata for listing purposes for every user in the shared list.
    await Promise.all(
        initialShared.map(async (uid) => {
            await kv.set(`${sourceKey}:${uid}`, {
                uploadedAt: new Date().toISOString(),
                documentName: name,
                type: "custom",
            });
        })
    );

    // Update the access mapping: store the shared user IDs array.
    await kv.set(`embeddingMapping:${sourceKey}`, initialShared);
    // Update the owner mapping with the uploader’s userId.
    await kv.set(`embeddingOwner:${sourceKey}`, userId);

    // *** NEW: Update the global embedding index ***
    const indexKey = "embeddingIndex1";
    let currentIndex: string[] = [];
    const indexData = await kv.get(indexKey);
    if (indexData) {
        currentIndex = indexData as string[];
    }
    if (!currentIndex.includes(sourceKey)) {
        currentIndex.push(sourceKey);
        await kv.set(indexKey, currentIndex);
    }
}
