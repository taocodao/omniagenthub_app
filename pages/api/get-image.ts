import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { imagePath } = req.query;

    if (!imagePath) {
        return res.status(400).json({ message: 'Image path is required' });
    }

    const filePath = path.resolve('./uploads', imagePath as string);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error('Error reading image file:', err);
            return res.status(500).json({ message: 'Error reading image file' });
        }

        res.setHeader('Content-Type', 'image/jpeg'); // Adjust the content type as needed
        res.send(data);
    });
}
