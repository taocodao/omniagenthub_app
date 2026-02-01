// pages/api/admin/cleanupCompanyUsers.ts
// List users: http://localhost:3000/api/admin/cleanupCompanyUsers?company=TaocoDAO&action=list
// Preview cleanup: http://localhost:3000/api/admin/cleanupCompanyUsers?company=TaocoDAO&action=cleanup
// Execute cleanup: http://localhost:3000/api/admin/cleanupCompanyUsers?company=TaocoDAO&action=cleanup&confirm=true

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { company, action, confirm } = req.query;

    if (!company || typeof company !== 'string') {
        return res.status(400).json({ error: 'Missing company parameter' });
    }

    try {
        // Get current company users
        const companyUsersKey = `companyUsers:${company}`;
        const storedUserAddresses = await kv.get<string[]>(companyUsersKey);

        if (!storedUserAddresses || !Array.isArray(storedUserAddresses)) {
            return res.status(200).json({ message: 'No users found', company, users: [] });
        }

        // Map users with their names
        const usersWithNames = await Promise.all(
            storedUserAddresses.map(async (addr) => {
                const userName = await kv.get<string>(`userName:${addr}`);
                return { address: addr, name: userName || 'Unknown' };
            })
        );

        // Action: list - just show all users
        if (action === 'list' || !action) {
            return res.status(200).json({
                company,
                totalUsers: usersWithNames.length,
                users: usersWithNames,
            });
        }

        // Action: cleanup for TaocoDAO
        if (action === 'cleanup' && company === 'TaocoDAO') {
            // Users to keep by ADDRESS (partial match for shortened addresses):
            // 1. erichuang2005@gmail.com - 0xc58aCc046d60FE877aC6fA3070665743Da52A89C
            // 2. Eric - 0xDC5E...38D0 (partial)

            const keepPatterns = [
                '0xc58acc046d60fe877ac6fa3070665743da52a89c', // erichuang2005@gmail.com
                '0xdc5e',  // Eric (starts with)
            ];

            const keepAddresses: string[] = [];

            for (const user of usersWithNames) {
                const addrLC = user.address.toLowerCase();

                for (const pattern of keepPatterns) {
                    if (addrLC === pattern || addrLC.startsWith(pattern)) {
                        keepAddresses.push(user.address);
                        break;
                    }
                }
            }

            if (confirm !== 'true') {
                return res.status(200).json({
                    message: 'Preview - add &confirm=true to execute',
                    company,
                    currentUsers: usersWithNames,
                    willKeep: usersWithNames.filter(u => keepAddresses.includes(u.address)),
                    willRemove: usersWithNames.filter(u => !keepAddresses.includes(u.address)),
                });
            }

            // Execute cleanup
            await kv.set(companyUsersKey, keepAddresses);

            // Get updated list
            const updatedUsers = await kv.get<string[]>(companyUsersKey);
            const updatedWithNames = await Promise.all(
                (updatedUsers || []).map(async (addr) => {
                    const userName = await kv.get<string>(`userName:${addr}`);
                    return { address: addr, name: userName || 'Unknown' };
                })
            );

            return res.status(200).json({
                message: 'Cleanup complete!',
                company,
                remainingUsers: updatedWithNames,
                removedCount: storedUserAddresses.length - keepAddresses.length,
            });
        }

        return res.status(400).json({ error: 'Invalid action. Use action=list or action=cleanup' });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Operation failed', details: String(error) });
    }
}
