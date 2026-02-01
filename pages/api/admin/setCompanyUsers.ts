// pages/api/admin/setCompanyUsers.ts
// Execute: http://localhost:3000/api/admin/setCompanyUsers?company=TaocoDAO&confirm=true

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { company, confirm } = req.query;

    if (company !== 'TaocoDAO') {
        return res.status(400).json({ error: 'Only TaocoDAO is supported' });
    }

    // Correct addresses to set:
    // 1. erichuang2005@gmail.com
    // 2. Eric
    const correctUsers = [
        '0xc58aCc046d60FE877aC6fA3070665743Da52A89C', // erichuang2005@gmail.com
        '0xDC5ECB5a773dce39B7925Eb7c2838517ca4938D0', // Eric
    ];

    try {
        const companyUsersKey = `companyUsers:TaocoDAO`;

        // Get current state
        const currentUsers = await kv.get<string[]>(companyUsersKey);

        if (confirm !== 'true') {
            return res.status(200).json({
                message: 'Preview - add &confirm=true to execute',
                company: 'TaocoDAO',
                currentData: currentUsers,
                willSetTo: correctUsers,
            });
        }

        // Directly set the correct user list
        await kv.set(companyUsersKey, correctUsers);

        // Verify
        const newUsers = await kv.get<string[]>(companyUsersKey);

        // Get usernames for display
        const usersWithNames = await Promise.all(
            (newUsers || []).map(async (addr) => {
                const userName = await kv.get<string>(`userName:${addr}`);
                return { address: addr, name: userName || 'Unknown' };
            })
        );

        return res.status(200).json({
            message: 'Company users set successfully!',
            company: 'TaocoDAO',
            users: usersWithNames,
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Operation failed', details: String(error) });
    }
}
