// File: lib/processEmail.ts
import { createClient } from '@vercel/kv';
import OpenAI from 'openai';
import sgMail from '@sendgrid/mail';
import { RateLimitError } from './types';

const KV_REST_API_URL = process.env.KV_REST_API_URL!;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const ASSISTANT_ID = 'asst_kDoH4kba6p0BPOmORNMXRrVU';

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !OPENAI_API_KEY || !SENDGRID_API_KEY) {
    throw new Error('Missing required environment variables');
}

sgMail.setApiKey(SENDGRID_API_KEY);
const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function runAssistantForEmail(
    assistantId: string,
    threadId: string,
    prompt: string
): Promise<string> {
    try {
        const run = await openai.beta.threads.messages.create(threadId, { role: 'user', content: prompt });
        let runStatus = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
        let attempts = 0;
        const MAX_ATTEMPTS = 300; // 5 minute timeout (300 * 1s)

        while (runStatus.status !== 'completed' && attempts < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;

            if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
                throw new Error(`Assistant failed: ${runStatus.last_error?.message}`);
            }
        }

        if (attempts >= MAX_ATTEMPTS) {
            throw new Error('OpenAI processing timeout (5 minutes)');
        }


        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data
            .filter((message: any) => message.role === 'assistant')
            .map((message: any) => {
                const textContent = message.content.find((content: any) => 'text' in content);
                return textContent && 'text' in textContent ? textContent.text.value : '';
            })
            .join('\n');
        return assistantMessage;
    } catch (error: any) {
        if (error.status === 429) {
            const retryAfter = (error.headers?.['retry-after'] || 60) * 1000;
            const rateLimitError: RateLimitError = new Error(
                `OpenAI rate limit exceeded. Retry after ${retryAfter}ms`
            );
            rateLimitError.retryAfter = retryAfter;
            throw rateLimitError;
        }
        throw error;
    }
}

export async function processEmail(
    senderName: string,
    companyName: string,
    recipientEmailParam?: string,
    firstNameParam?: string,
    isProd: boolean = true
): Promise<string> {
    // Lookup sender configuration by senderName (key: "Sender:<senderName>")
    const senderKey = `Sender:${senderName.trim()}`;
    const senderConfigData = await kv.get(senderKey);
    if (!senderConfigData) {
        throw new Error(`Sender config not found for ${senderName}`);
    }
    const senderConfig = senderConfigData as Record<string, string>;

    // Lookup customer profile by company name (key: "Company:<companyName>")
    const companyKey = `Company:${decodeURIComponent(companyName)}`;
    const companyData = await kv.get(companyKey);
    if (!companyData) {
        throw new Error(`Customer profile not found for ${companyName}`);
    }
    const customerRecord = companyData as Record<string, string>;
    const customerProfile = customerRecord['Customer Profile'] || '';

    // Use provided recipientEmail/firstName or fallback to customer record
    let recipientEmail = recipientEmailParam || customerRecord['Email'];
    let firstName = firstNameParam || customerRecord['First Name'];
    if (!recipientEmail || !firstName) {
        throw new Error('Missing recipient email or first name.');
    }

    // Check for existing email content using key "EmailContent:<senderName>_<recipientEmail>"
    const emailContentKey = `EmailContent:${senderName.trim()}_${recipientEmail.trim()}`;
    const storedEmailDataRaw = await kv.get(emailContentKey);
    let emailContent: string;
    let parsedSubject = '';
    let timestamps: string[] = [];
    if (storedEmailDataRaw) {
        try {
            const parsed = typeof storedEmailDataRaw === 'string'
                ? JSON.parse(storedEmailDataRaw)
                : storedEmailDataRaw;

            emailContent = parsed.content;
            parsedSubject = parsed.subject || '';
            timestamps = parsed.timestamps || [];

        } catch (error) {
            console.error("Error parsing stored email content:", error);
            emailContent = typeof storedEmailDataRaw === 'string'
                ? storedEmailDataRaw
                : JSON.stringify(storedEmailDataRaw);
            timestamps = [];
        }
    } else {
        // Generate email content using assistant
        const ctaLink = isProd
            ? `https://app.web3aistore.com/Query_new?url=${encodeURIComponent(senderConfig.companyWebsite)}`
            : `https://app.web3aistore.com/Query_new?url=${encodeURIComponent(senderConfig.companyWebsite)}`;
        // : `http://localhost:3000/Query_new?url=${encodeURIComponent(senderConfig.companyWebsite)}`;
        let prompt = `Generate a highly personalized cold email campaign for the recipient using the following details.

Customer Profile:
${customerProfile}

Recipient First Name: ${firstName}

Sender Details:
Name: ${senderConfig.senderName}
Title: ${senderConfig.senderTitle}
Company: ${senderConfig.senderCompany}
Contact E-mail: ${senderConfig.senderContactEmail}

Sender Company Profile:
${senderConfig.senderCompanyProfile}

${senderConfig.subjectLine ? 'Subject Line: ' + senderConfig.subjectLine : 'Subject Line: (auto-generated based on recipient profile)'}

${senderConfig.emailTemplate ? 'Email Template Provided: ' + senderConfig.emailTemplate : ''}

Company Website: ${senderConfig.companyWebsite}

CTA Instructions:
1. Primary CTA: Include a hyperlink with the exact wording: "Check out our website ${senderConfig.companyWebsite} and chat with our interactive tool to get a deeper understanding of our offerings." Use this DIRECT link: ${ctaLink}(DO NOT shorten or modify this URL).
2. Secondary CTA: Mention that if the recipient is interested in turning their website into a smart knowledge base that answers all customers’ and employees’ questions, they should contact support@web3aistore.com.

Render the final email content in HTML format using a handwriting font style (e.g., font-family: 'Bradley Hand', cursive;).`;
        const threadResponse = await openai.beta.threads.create({});
        const threadId = threadResponse.id;
        const assistantResponse = await runAssistantForEmail(ASSISTANT_ID, threadId, prompt);

        // Remove markdown code fences if any and extract subject line
        const lines = assistantResponse.split('\n');
        if (lines.length > 0 && lines[0].includes('```')) {
            lines.shift();
        }
        for (let i = 0; i < lines.length; i++) {
            const plainLine = lines[i].replace(/<[^>]+>/g, '').trim();
            if (plainLine.toLowerCase().startsWith('subject:')) {
                parsedSubject = plainLine.replace(/subject:/i, '').trim();
                lines.splice(i, 1);
                break;
            }
        }
        if (!parsedSubject) {
            parsedSubject = senderConfig.subjectLine || 'Your Personalized Email';
        }
        emailContent = lines.join('\n');

        // Save generated email content with timestamp and subject
        const timestamp = new Date().toISOString();
        const emailDataToSave = JSON.stringify({ content: emailContent, subject: parsedSubject, timestamps: [new Date().toISOString()] });
        await kv.set(emailContentKey, emailDataToSave);
    }

    // If not production, override recipient email
    if (!isProd) {
        recipientEmail = 'eric@omnisearching.ai';
    }

    const emailData: sgMail.MailDataRequired = {
        to: recipientEmail,
        from: { email: senderConfig.senderContactEmail, name: senderConfig.senderName },
        replyTo: senderConfig.senderContactEmail,
        subject: parsedSubject,
        text: emailContent.replace(/<[^>]+>/g, ''),
        html: emailContent,
        trackingSettings: {
            clickTracking: {
                enable: false // Disable SendGrid link rewriting
            }
        },


    };


    try {
        // Set up timeout and email send race
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SendGrid timeout after 30 seconds')), 30000)
        );

        // Race between email send and timeout
        await Promise.race([
            sgMail.send(emailData),
            timeoutPromise
        ]);

        // Only update timestamps if send is successful
        const newTimestamps = [...timestamps, new Date().toISOString()];
        await kv.set(emailContentKey, JSON.stringify({
            content: emailContent,
            subject: parsedSubject,
            timestamps: newTimestamps
        }));

    } catch (err: any) {
        console.error('Email send error:', err.message);

        if (err.message.includes('timeout')) {
            // Handle timeout-specific logic
            console.log('Proceeding to next email due to timeout');
            throw new Error('Email send timed out after 30 seconds');
        }

        // Handle other errors
        throw new Error(`Failed to send email: ${err.message}`);
    }



    return emailContent;
}
