// pages/api/resolveUri.js
import { ThirdwebStorage } from "@thirdweb-dev/storage";

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { uri } = req.body;

        try {
            // Initialize ThirdwebStorage with your secretKey server-side
            const storage = new ThirdwebStorage({
                secretKey: process.env.TEMPLATE_CLIENT_ID, // Use the actual environment variable for your secret key
            });

            // Resolve the URI to a URL
            const url = await storage.resolveScheme(uri);

            // Respond with the URL
            res.status(200).json({ url });
        } catch (error) {
            console.error("Error resolving URI:", error);
            res.status(500).json({ error: "Error resolving URI" });
        }
    } else {
        // Handle any non-POST requests
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
