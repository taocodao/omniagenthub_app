// pages/api/add-role-mappings.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import formidable, { Fields, Files, File } from 'formidable';
import fs from 'fs';
import path from 'path';

require('dotenv').config(); // Load environment variables

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const uploadDir = path.resolve('./uploads');
fs.mkdirSync(uploadDir, { recursive: true });

export const config = {
    api: {
        bodyParser: false, // Disable default body parser to handle file uploads
    },
};

// Handle file upload and save it to the specified directory
const handleFileUpload = (file: File): Promise<string> => {
    const tempPath = file.filepath;
    const fileName = `${Date.now()}-${file.originalFilename}`;
    const savePath = path.join(uploadDir, fileName);

    return new Promise<string>((resolve, reject) => {
        fs.rename(tempPath, savePath, (err) => {
            if (err) reject(err);
            else resolve(savePath);
        });
    });
};

// Helper to validate JSON strings
const isValidJSON = (str: string): boolean => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const form = formidable({ multiples: true }); // Support multiple files

    form.parse(req, async (err: any, fields: Fields, files: Files) => {
        if (err) {
            console.error('Form parse error:', err);
            return res.status(500).json({ message: 'Form parse error' });
        }

        // Extract fields from the form
        const department = Array.isArray(fields.department) ? fields.department[0] : fields.department;
        const role = Array.isArray(fields.role) ? fields.role[0] : fields.role;
        const apiKey = Array.isArray(fields.apiKey) ? fields.apiKey[0] : fields.apiKey;
        const user = Array.isArray(fields.user) ? fields.user[0] : fields.user;
        const price = Array.isArray(fields.price) ? fields.price[0] : fields.price;
        let imageUrl = Array.isArray(fields.image) ? fields.image[0] : fields.image;
        const userAddress = Array.isArray(fields.userAddress) ? fields.userAddress[0] : fields.userAddress; // New field

        // Validate required fields
        if (!department || !role || !user || !price) {
            return res.status(400).json({ message: 'Department, Role, User, and Price are required' });
        }

        // Only require userAddress when department is 'My Customized GPT'
        if (department === 'My Customized GPT' && !userAddress) {
            return res.status(400).json({ message: 'UserAddress is required for My Customized GPT' });
        }


        // Handle image file upload if provided
        if (files.image && Array.isArray(files.image)) {
            const file = files.image[0];
            try {
                imageUrl = await handleFileUpload(file);
            } catch (uploadError) {
                console.error('Image upload error:', uploadError);
                return res.status(500).json({ message: 'Image upload failed' });
            }
        }

        const key = `${department}:${role}`;
        const mappings: Record<string, string> = {
            [`${key}:APIkey`]: apiKey || "",   // Use an empty string if apiKey is null or undefined
            [`${key}:user`]: user || "",       // Use an empty string if user is null or undefined
            [`${key}:price`]: price || "",     // Use an empty string if price is null or undefined
            [`${key}:userAddress`]: userAddress || "", // Added userAddress mapping
        };

        // Add the image URL to the mappings if it exists
        if (imageUrl) {
            mappings[`${key}:image`] = imageUrl;
        }

        try {
            // Save mappings to the KV store
            await Promise.all(Object.entries(mappings).map(([mapKey, mapValue]) => kv.set(mapKey, mapValue)));

            // Update the Department -> Role mapping
            const departmentRolesKey = `department:${department}:roles`;
            let roles: string[] = await kv.get(departmentRolesKey)
                .then((res: any) => {
                    if (Array.isArray(res)) {
                        return res;
                    } else if (typeof res === 'string' && isValidJSON(res)) {
                        return JSON.parse(res);
                    } else {
                        console.warn(`Invalid data for key ${departmentRolesKey}: ${res}`);
                        return [];
                    }
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
