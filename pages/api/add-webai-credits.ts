// pages/api/add-webai-credits.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';

const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

interface AddWebaiCreditsRequest {
    userKey: string;
    hashedUserId: string;
    webaiCredits: number;
    freeUploads?: number;
    freeWebScrape?: number;
    promoCodeUsed?: string;
    setMode?: boolean; // If true, SET the credits instead of incrementing (promo takes priority)
}

// Safe increment helper function
async function safeIncrement(key: string, incrementBy: number): Promise<number> {
    try {
        // Try direct increment first
        return await kv.incrby(key, incrementBy);
    } catch (error: any) {
        // If we get a "not an integer" error, fix it and retry
        if (error.message && error.message.includes('not an integer or out of range')) {
            // Get current value
            const currentValue = await kv.get(key);

            // Convert to integer (default to 0 if not a number)
            let intValue = 0;
            if (currentValue !== null) {
                // Parse as float first, then round to integer
                const floatValue = parseFloat(String(currentValue));
                intValue = isNaN(floatValue) ? 0 : Math.round(floatValue);
            }

            // Set the integer value in Redis
            await kv.set(key, intValue);

            // Now try the increment again
            return await kv.incrby(key, incrementBy);
        }
        // Rethrow any other errors
        throw error;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const configEnv = process.env.NEXT_PUBLIC_CONFIG_ENV || 'prod';
    const isLocalhostRequest = (): boolean => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : '';
        const remoteAddress = req.socket.remoteAddress || '';
        return (
            ip === '127.0.0.1' ||
            ip === '::1' ||
            remoteAddress === '127.0.0.1' ||
            remoteAddress === '::1' ||
            req.headers.host?.includes('localhost') === true
        );
    };

    if (configEnv !== 'dev' || !isLocalhostRequest()) {
        const token = req.headers['x-updater-token'];
        if (typeof token !== 'string' || token !== process.env.UPDATER_SECRET_TOKEN) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or missing token.' });
        }
    }

    const { userKey, hashedUserId, webaiCredits, freeUploads, freeWebScrape, promoCodeUsed, setMode } = req.body as AddWebaiCreditsRequest;
    if (!userKey || typeof webaiCredits !== 'number' || webaiCredits <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
    }

    try {
        let hashedUserKey;
        if (hashedUserId)
            hashedUserKey = hashedUserId;
        else
            hashedUserKey = userKey;

        if (promoCodeUsed) {
            // Handle different promo code formats with different validation rules
            if (promoCodeUsed.includes(':')) {
                // This is a unique link format (hashedEmail:prom40)
                // Use a global key to track usage - not tied to any specific user
                const globalPromoKey = `global:promo:${promoCodeUsed}`;
                const promoAlreadyUsed = await kv.get(globalPromoKey);
                if (promoAlreadyUsed) {
                    return res.status(400).json({
                        success: false,
                        message: 'This unique promotion link has already been used.',
                    });
                }
                // Mark this unique promo as used globally
                await kv.set(globalPromoKey, 'used');
            } else {
                // Standard promo code (like "prom40")
                // Track usage per user address
                const promoUsageKey = `${hashedUserKey}:promo:${promoCodeUsed}`;
                const promoAlreadyUsed = await kv.get(promoUsageKey);
                if (promoAlreadyUsed) {
                    return res.status(400).json({
                        success: false,
                        message: 'Promo code has already been used by this account.',
                    });
                }
                // Mark this promo as used by this user
                await kv.set(promoUsageKey, 'used');
            }
        }

        const webaiCreditsKey = `${hashedUserKey}:webaiCredits`;
        const freeUploadsKey = `${hashedUserKey}:freeUploads`;
        const freeWebScrapeKey = `${hashedUserKey}:freeWebScrape`;

        // If setMode is true (promo code priority), SET the credits instead of incrementing
        // This ensures promo code amount replaces any existing signup credits
        let updatedCredits: number;
        if (setMode) {
            await kv.set(webaiCreditsKey, webaiCredits);
            updatedCredits = webaiCredits;
        } else {
            updatedCredits = await safeIncrement(webaiCreditsKey, webaiCredits);
        }

        const updatedBalances = {
            webaiCredits: updatedCredits,
            freeUploads: freeUploads ? await safeIncrement(freeUploadsKey, freeUploads) : undefined,
            freeWebScrape: freeWebScrape ? await safeIncrement(freeWebScrapeKey, freeWebScrape) : undefined,
        };

        return res.status(200).json({
            success: true,
            message: 'WEBAI Credits updated successfully.',
            updatedBalances,
        });
    } catch (error) {
        console.error('Error updating WEBAI Credits:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}
