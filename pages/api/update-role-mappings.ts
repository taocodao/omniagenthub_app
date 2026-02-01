require('dotenv').config(); // Load environment variables
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import formidable, { Fields, Files } from 'formidable';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export const config = {
    api: {
        bodyParser: false,
    },
};

const isValidJSON = (str: string): boolean => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const form = formidable();

    form.parse(req, async (err: any, fields: Fields, files: Files) => {
        if (err) {
            console.error('Form parse error:', err);
            return res.status(500).json({ message: 'Form parse error' });
        }

        const department = Array.isArray(fields.department) ? fields.department[0] : fields.department;
        const role = Array.isArray(fields.role) ? fields.role[0] : fields.role;
        const apiKey = Array.isArray(fields.apiKey) ? fields.apiKey[0] : fields.apiKey;
        const user = Array.isArray(fields.user) ? fields.user[0] : fields.user;
        const price = Array.isArray(fields.price) ? fields.price[0] : fields.price;
        const imageUrl = Array.isArray(fields.image) ? fields.image[0] : fields.image;

        if (!department || !role || !user || !price) {
            console.log("Department, Role, User, and Price are required");
            return res.status(400).json({ message: 'Department, Role, User, and Price are required' });
        }

        const key = `${department}:${role}`;
        const mappings: Record<string, string> = {
            [`${key}:user`]: user,
            [`${key}:price`]: price,
        };

        // Only add API key to mappings if it's not null or empty
        if (apiKey) {
            mappings[`${key}:APIkey`] = apiKey;
        }

        try {
            if (imageUrl) {
                mappings[`${key}:image`] = imageUrl;
            }

            await Promise.all(Object.entries(mappings).map(([mapKey, mapValue]) => kv.set(mapKey, mapValue)));

            // Update Department -> Role mapping
            const departmentRolesKey = `department:${department}:roles`;
            let roles: string[] = await kv.get(departmentRolesKey)
                .then((res: any) => {
                    if (Array.isArray(res)) return res;
                    if (typeof res === 'string' && isValidJSON(res)) return JSON.parse(res);
                    console.warn(`Invalid data for key ${departmentRolesKey}: ${res}`);
                    return [];
                });

            if (!roles.includes(role)) {
                roles.push(role);
                await kv.set(departmentRolesKey, JSON.stringify(roles));
            }

            return res.status(200).json({ message: 'Role mappings added successfully' });
        } catch (error) {
            console.error('Error saving role mappings to KV database:', error);
            return res.status(500).json({ message: 'Error saving role mappings to KV database.' });
        }
    });
}
