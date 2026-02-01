// pages/api/retrieve-checkout-session.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2024-09-30.acacia', // Latest API version
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { session_id } = req.query;

    if (!session_id || Array.isArray(session_id)) {
        return res.status(400).json({ error: 'Missing or invalid session_id' });
    }

    try {
        const session: Stripe.Checkout.Session = await stripe.checkout.sessions.retrieve(session_id);

        res.status(200).json({ session });
    } catch (error: any) {
        console.error('Error retrieving checkout session:', error);
        res.status(500).json({ error: 'Failed to retrieve checkout session' });
    }
}
