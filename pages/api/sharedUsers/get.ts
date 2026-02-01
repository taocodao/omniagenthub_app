//pages\api\sharedUsers\get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@vercel/kv";

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Helper function for obtaining the user name from the user address.
async function getUserName(address: string): Promise<string> {
    const userName = await kv.get(`userName:${address}`);
    return (userName as string) || address;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const sourceKey = req.query.sourceKey as string;
    if (!sourceKey) {
        return res.status(400).json({ error: "Missing sourceKey parameter" });
    }

    try {
        const key = `selectedSources1:${sourceKey}`;
        console.log("Inside get ts the key is ", key);
        const data = await kv.get(key);
        console.log("Inside get ts the data is ", data);
        const userAddresses: string[] = data ? (data as string[]) : [];

        const selectedSources = await Promise.all(
            userAddresses.map(async (address) => ({
                userAddress: address,
                userName: await getUserName(address),
            }))
        );
        console.log("Inside the Get.ts the return is ", selectedSources)
        res.status(200).json({ selectedSources });
    } catch (error) {
        console.error("Error retrieving selected sources:", error);
        res.status(500).json({ error: "Error retrieving selected sources" });
    }
}
