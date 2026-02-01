// pages/api/get-role-mapping.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

import { kv, scanAllKeys } from '../../utils/redis-helpers';

// Helper function to validate Ethereum addresses
const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Log the incoming request method and body for debugging
    console.log('Received request:', {
        method: req.method,
        body: req.body,
    });

    // Ensure the request method is POST
    if (req.method !== 'POST') {
        console.log('Invalid request method:', req.method);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { userAddress, department } = req.body;

    // Log the extracted parameters
    console.log('Extracted Parameters:', { userAddress, department });

    // Validate presence of userAddress and department
    if (!userAddress || !department) {
        console.log('Missing parameters:', { userAddress, department });
        return res.status(400).json({ message: 'User address and department are required' });
    }

    // Validate the format of userAddress
    if (!isValidEthereumAddress(userAddress)) {
        console.log('Invalid user address format:', userAddress);
        return res.status(400).json({ message: 'Invalid user address format.' });
    }

    try {
        if (department === "My Customized GPT") {
            // **Handling "My Customized GPT" Category**

            console.log(`Handling category: ${department}`);

            // Fetch all keys under the "My Customized GPT" department
            // Key Pattern: "My Customized GPT:<role>:*"
            const prefix = `${department}:*`;
            console.log(`Fetching keys with prefix: ${prefix}`);

            const keys = await scanAllKeys(prefix);
            console.log(`Retrieved Keys (${keys.length}):`, keys);

            // Extract unique roles
            const rolesSet = new Set<string>();
            keys.forEach(key => {
                const parts = key.split(':');
                if (parts.length >= 2) { // Ensure there's at least department and role
                    const role = parts[1];
                    rolesSet.add(role);
                } else {
                    console.log(`Invalid key format (less than 2 parts): ${key}`);
                }
            });

            const allRoles = Array.from(rolesSet);
            console.log(`All Roles in "${department}" (${allRoles.length}):`, allRoles);

            const matchingRoles: string[] = [];

            for (const role of allRoles) {
                const roleKey = `${department}:${role}`;
                const userAddressKey = `${roleKey}:userAddress`;

                console.log(`Fetching userAddress for role "${role}" using key "${userAddressKey}"`);

                const storedUserAddress = await kv.get(userAddressKey);
                console.log(`Stored User Address for role "${role}":`, storedUserAddress);

                if (storedUserAddress === userAddress) {
                    console.log(`User address matches for role "${role}". Adding to matchingRoles.`);
                    matchingRoles.push(role);
                } else {
                    console.log(`User address does NOT match for role "${role}". Skipping.`);
                }
            }

            console.log(`Matching Roles (${matchingRoles.length}):`, matchingRoles);

            return res.status(200).json(matchingRoles);
        } else {
            // **Handling Other Categories**

            console.log(`Handling category: ${department}`);

            // Fetch all keys under the specified department
            // Key Pattern: "<department>:<role>:*"
            const prefix = `${department}:*`;
            console.log(`Fetching keys with prefix: ${prefix}`);

            const keys = await scanAllKeys(prefix);
            console.log(`Retrieved Keys (${keys.length}):`, keys);

            const rolesSet = new Set<string>();

            for (const key of keys) {
                const parts = key.split(':');
                console.log(`Processing Key: ${key} -> Parts:`, parts);

                if (parts.length < 2) {
                    console.log(`Skipping invalid key format (less than 2 parts): ${key}`);
                    continue; // Ensure correct key format: department:role:field
                }

                const role = parts[1];
                rolesSet.add(role);
                console.log(`Added role "${role}" to rolesSet.`);
            }

            const roles = Array.from(rolesSet);
            console.log(`Roles in category "${department}" (${roles.length}):`, roles);

            return res.status(200).json(roles);
        }
    } catch (error) {
        console.error('Error fetching role mappings from KV database:', error);
        return res.status(500).json({ message: 'Error fetching role mappings from KV database.' });
    }
}
