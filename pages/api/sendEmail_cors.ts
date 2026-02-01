// File: pages/api/sendEmail.ts

import type { NextApiRequest, NextApiResponse } from "next";
import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
    console.error("SENDGRID_API_KEY is not set in the environment variables.");
    process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Set CORS headers to allow cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Allow POST and OPTIONS methods
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allow these headers
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight response for 24 hours

    // Handle OPTIONS method for preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle actual request methods
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed. Use POST." });
    }

    const { recipient, subject, message, sender, html, fromDisplay, replyTo } = req.body;

    if (!recipient || !subject || (!message && !html) || !sender) {
        return res.status(400).json({ message: 'Missing required fields ("recipient", "subject", "message" or "html", or "sender").' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient) || !emailRegex.test(sender)) {
        return res.status(400).json({ message: "Invalid email address format." });
    }

    try {
        const emailData: sgMail.MailDataRequired = {
            to: recipient,
            from: {
                email: sender,
                name: fromDisplay || undefined,
            },
            replyTo: replyTo || undefined,
            subject: subject,
            text: message, // Always include plain text version
            html: html || undefined, // Include HTML version if provided
        };

        await sgMail.send(emailData);

        console.log(`Email sent to ${recipient} from ${sender}.`);
        res.status(200).json({ message: `Email sent successfully to ${recipient}.` });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to send email.", error: (error as Error).message });
    }
}
