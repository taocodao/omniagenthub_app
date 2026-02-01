// pages/api/admin/debugCompanyUsers.ts
// Debug: http://localhost:3000/api/admin/debugCompanyUsers
// Fix all: http://localhost:3000/api/admin/debugCompanyUsers?setUsers=true

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { setUsers } = req.query;

    // Main user address (erichuang2005@gmail.com)
    const mainAddr = '0xc58aCc046d60FE877aC6fA3070665743Da52A89C';

    // Correct users to keep
    const correctUsers = [
        '0xc58aCc046d60FE877aC6fA3070665743Da52A89C', // erichuang2005@gmail.com
        '0xDC5ECB5a773dce39B7925Eb7c2838517ca4938D0', // Eric
    ];

    try {
        // Check what company name is stored for the main user
        const companyName1 = await kv.get(`companyName1:${mainAddr}`);
        const companyName = await kv.get(`companyName:${mainAddr}`);

        // All possible company name variations
        const possibleCompanyNames = [
            companyName1,
            companyName,
            'TaocoDAO',
            'Taocodao',
            'taocodao',
            'TAOCODAO',
        ].filter((name): name is string => typeof name === 'string');

        // Remove duplicates
        const uniqueCompanyNames = [...new Set(possibleCompanyNames)];

        const results: Record<string, unknown> = {
            mainUserAddress: mainAddr,
            'companyName1:': companyName1,
            'companyName:': companyName,
            possibleCompanyNames: uniqueCompanyNames,
        };

        // Get company users for all possible keys
        for (const company of uniqueCompanyNames) {
            results[`companyUsers:${company}`] = await kv.get(`companyUsers:${company}`);
        }

        if (setUsers === 'true') {
            // Set ALL possible company user keys to the correct value
            for (const company of uniqueCompanyNames) {
                await kv.set(`companyUsers:${company}`, correctUsers);
                results[`SET companyUsers:${company}`] = correctUsers;
            }

            results['ACTION'] = 'Updated all company user keys';
            results['newValue'] = correctUsers;
        }

        return res.status(200).json(results);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: String(error) });
    }
}
