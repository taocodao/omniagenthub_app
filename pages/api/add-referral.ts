// pages/api/add-referral.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { referrerAddress, refereeAddress, skipInitialCredits } = req.body;

    // At least refereeAddress must be provided
    if (!refereeAddress) {
        return res.status(400).json({ message: 'Referee address is required' });
    }

    try {
        const refereeKey = refereeAddress;

        // Check if referee already has WEBAI Credits
        const existingCredits = await kv.get(`${refereeKey}:webaiCredits`);
        if (existingCredits !== null && existingCredits !== undefined) {
            return res.status(400).json({ message: 'Referee already has WEBAI Credits' });
        }

        const initialWebaiCredits = Number(process.env.NEXT_PUBLIC_INITIAL_WEBAI_CREDITS) || 10; // Default to 10 if not set
        const referralBonus = Number(process.env.NEXT_PUBLIC_REFERRAL_BONUS) || 2; // Default to 2 if not set

        // If skipInitialCredits is true (promo code pending), don't give initial credits
        // The promo code flow will set the credits instead
        let totalCredits = skipInitialCredits ? 0 : initialWebaiCredits;

        if (referrerAddress) {
            const referrerKey = referrerAddress;

            // Update WEBAI Credits for the referrer
            let referrerCredits = await kv.get(`${referrerKey}:webaiCredits`) as number;
            referrerCredits = referrerCredits ? Number(referrerCredits) : 0;
            await kv.set(`${referrerKey}:webaiCredits`, referrerCredits + referralBonus);
        }

        // Always add referral bonus to referee's WEBAI Credits (unless promo will handle everything)
        if (!skipInitialCredits) {
            totalCredits += referralBonus;
            // Set WEBAI Credits for the referee
            await kv.set(`${refereeKey}:webaiCredits`, totalCredits);
        }
        // If skipInitialCredits, don't set anything here - promo code will set the final amount

        return res.status(200).json({
            message: 'Referral processed successfully',
            creditsGiven: skipInitialCredits ? 0 : totalCredits,
            skipInitialCredits: skipInitialCredits || false
        });
    } catch (error) {
        console.error('Error processing referral:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
