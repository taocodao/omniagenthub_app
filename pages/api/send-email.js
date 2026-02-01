import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        // Extract email data from the request body
        const { to, subject, text, html } = req.body;

        // Create a transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER, // Use environment variables
                pass: process.env.EMAIL_PASS,
            },
        });

        try {
            // Send email using the transporter
            let info = await transporter.sendMail({
                from: `"Web3AIStore" <${process.env.EMAIL_USER}>`, // Use the environment variable
                to, // Taken from the request body
                subject, // Taken from the request body
                text, // Taken from the request body
                //html: html || "<b>Hello world?</b>", // Use HTML from the request body if provided
            });

            console.log("Message sent: %s", info.messageId);
            res.status(200).json({ message: 'Email sent' });
        } catch (error) {
            console.error("Error sending email", error);
            res.status(500).json({ error: 'Error sending email', details: error.message });
        }
    } else {
        // Handle any non-POST requests
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
