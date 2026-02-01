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
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== "string") {
        return res
            .status(400)
            .json({ error: "Missing or invalid userAddress parameter" });
    }

    try {
        // Retrieve the company name for the requesting user.
        const companyKey = `companyName:${userAddress}`;
        const companyName = await kv.get(companyKey);
        if (!companyName || typeof companyName !== "string") {
            return res.status(404).json({ error: "Company name not found for user" });
        }

        console.log(`[getCompanyUsers] Company for ${userAddress}: ${companyName}`);

        // Retrieve the list of user addresses associated with that company.
        const companyUsersKey = `companyUsers:${companyName}`;
        const storedUserAddresses = await kv.get(companyUsersKey);
        console.log(`[getCompanyUsers] Retrieved addresses for ${companyUsersKey}:`, storedUserAddresses);

        if (!storedUserAddresses || !Array.isArray(storedUserAddresses)) {
            return res.status(200).json({ users: [] });
        }

        // Exclude the requesting user.
        const matchingUserAddresses = storedUserAddresses.filter(
            (addr) => addr !== userAddress
        );

        console.log("[getCompanyUsers] Matching user addresses:", matchingUserAddresses);

        // Fetch user names for all addresses
        const usersWithNames = await Promise.all(
            matchingUserAddresses.map(async (addr: string) => {
                const userName = await kv.get(`userName:${addr}`);
                return {
                    userAddress: addr,
                    userName: userName || addr // Fallback to address if no name found
                };
            })
        );

        const validCompanyUsers = usersWithNames.filter(
            (user): user is { userAddress: string; userName: string } => user !== null
        );

        console.log("[getCompanyUsers] Final company users list:", validCompanyUsers);
        return res.status(200).json({ users: validCompanyUsers });
    } catch (error) {
        console.error("Error fetching company users:", error);
        return res.status(500).json({ error: "Error fetching company users" });
    }
}
