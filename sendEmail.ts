import nodemailer from 'nodemailer';

const sendEmail = async (to: string, subject: string, text: string) => {
    try {
        // Create a transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: "your_smtp_host", // e.g., smtp.gmail.com for Gmail
            port: 587, // Common port for SMTP
            secure: false, // true for 465, false for other ports
            auth: {
                user: "your_email_address",
                pass: "your_email_password", // Use app-specific password if using Gmail
            },
        });

        // Send mail with defined transport object
        let info = await transporter.sendMail({
            from: '"Sender Name" <your_email_address>', // Sender address
            to: to, // List of receivers
            subject: subject, // Subject line
            text: text, // Plain text body
            // html: "<b>Hello world?</b>", // HTML body content (optional)
        });

        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

export default sendEmail;
