import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

interface EmailLeadData {
    email: string;
    walletAddress: string;
    websiteUrl: string;
    timestamp: string;
    chainUsed?: string;
    factoryAddress?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { email, walletAddress, websiteUrl } = req.body;

    if (!email || !walletAddress || !websiteUrl) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters: email, walletAddress, websiteUrl'
        });
    }

    try {
        // Create the key format: Email_Leads:<E-mail address> : <website url>
        const emailLeadKey = `Email_Leads:${email} : ${websiteUrl}`;

        // Check if this email-website combination already exists
        const existingLead = await kv.get(emailLeadKey);
        if (existingLead) {
            console.log(`Email lead already exists for ${email} on ${websiteUrl}`);
            return res.status(200).json({
                success: true,
                message: 'Email lead already exists for this website',
                existed: true
            });
        }

        // Prepare lead data
        const leadData: EmailLeadData = {
            email,
            walletAddress,
            websiteUrl,
            timestamp: new Date().toISOString(),
            chainUsed: req.body.chainUsed || 'unknown',
            factoryAddress: req.body.factoryAddress || 'unknown'
        };

        // Save the email lead with the specified key format
        await kv.set(emailLeadKey, JSON.stringify(leadData));

        // Also create a hashed email index for faster lookups
        const hashedEmail = HashUtil.hashTo(email);
        const emailIndexKey = `EmailIndex:${hashedEmail}`;

        // Get existing websites for this email
        const existingWebsites = await kv.get(emailIndexKey) || [];
        const websiteList = Array.isArray(existingWebsites) ? existingWebsites : [];

        // Add website if not already in the list
        if (!websiteList.includes(websiteUrl)) {
            websiteList.push(websiteUrl);
            await kv.set(emailIndexKey, websiteList);
        }

        // Create website-specific email list
        const websiteEmailsKey = `Website_Emails:${websiteUrl}`;
        const existingEmails = await kv.get(websiteEmailsKey) || [];
        const emailList = Array.isArray(existingEmails) ? existingEmails : [];

        // Add email if not already in the list
        if (!emailList.includes(email)) {
            emailList.push(email);
            await kv.set(websiteEmailsKey, emailList);
        }

        console.log(`✅ Email lead saved: ${email} for website: ${websiteUrl}`);

        // Add email promo bonus WEBAI credits for new email signups
        const emailPromoBonus = Number(process.env.NEXT_PUBLIC_EMAIL_PROMO_BONUS) || 20;
        const userCreditsKey = `${walletAddress}:webaiCredits`;

        // Check if user already has credits (to avoid double bonus)
        const existingCredits = await kv.get(userCreditsKey);
        const currentCredits = existingCredits ? Number(existingCredits) : 0;

        // Only add bonus if this is the first email submission for this user
        const userEmailBonusKey = `${walletAddress}:emailPromoBonus`;
        const alreadyReceivedBonus = await kv.get(userEmailBonusKey);

        let bonusAdded = false;
        if (!alreadyReceivedBonus) {
            await kv.set(userCreditsKey, currentCredits + emailPromoBonus);
            await kv.set(userEmailBonusKey, true);
            bonusAdded = true;
            console.log(`✅ Email promo bonus added: ${emailPromoBonus} WEBAI Credits for ${walletAddress}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Email lead saved successfully',
            data: {
                email,
                websiteUrl,
                timestamp: leadData.timestamp,
                key: emailLeadKey,
                bonusAdded,
                bonusAmount: bonusAdded ? emailPromoBonus : 0
            }
        });

    } catch (error) {
        console.error('Error saving email lead:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}
