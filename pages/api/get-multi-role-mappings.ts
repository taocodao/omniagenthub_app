require('dotenv').config(); // Load environment variables
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const isValidJSON = (str: string) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    //console.log('Received request body:', req.body);  // Log request body for debugging

    const { department, roles } = req.body;

    if (!department || !roles || !Array.isArray(roles) || roles.length === 0) {
        console.error('Missing department or roles');
        return res.status(400).json({ message: 'Department and Roles are required' });
    }

    try {
        const mappings = await Promise.all(roles.map(async (role: string) => {
            const key = `${department}:${role}`;
            const apiKey = await kv.get(`${key}:APIkey`);
            const user = await kv.get(`${key}:user`);
            const price = await kv.get(`${key}:price`);
            const image = await kv.get(`${key}:image`);

            //console.log(`Retrieved data for ${key}:`, { apiKey, user, price, image });  // Log retrieved data

            return {
                role,
                apiKey,
                user,
                price,
                image,
            };
        }));

        return res.status(200).json(mappings);
    } catch (error) {
        console.error('Error retrieving role mappings from KV database:', error);
        return res.status(500).json({ message: 'Error retrieving role mappings from KV database.' });
    }
}
