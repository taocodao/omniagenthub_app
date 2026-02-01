// pages/api/webhook.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import getRawBodyLib from 'raw-body'; // Renamed import to avoid conflict

export const config = {
    api: {
        bodyParser: false, // Disables body parsing to receive raw request body
    },
};

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2024-09-30.acacia',

});

// Your Stripe webhook secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
        let event: Stripe.Event;

        try {
            const rawBody = await fetchRawBody(req);

            const signature = req.headers['stripe-signature'] as string;

            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret!);
        } catch (err: any) {
            console.error(`Webhook Error: ${err.message}`);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutSession(session);
                break;
            // ... handle other event types as needed
            default:
                console.warn(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } else {
        res.setHeader('Allow', 'POST');
        res.status(405).end('Method Not Allowed');
    }
};

// Helper function to fetch raw body
async function fetchRawBody(req: NextApiRequest) {
    return await getRawBodyLib(req, {
        length: req.headers['content-length'],
        limit: '1mb',
        encoding: true,
    });
}

// Function to handle the Checkout Session
async function handleCheckoutSession(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const productId = session.metadata?.productId;

    if (!userId || !productId) {
        console.error('Missing userId or productId in session metadata');
        return;
    }

    // TODO: Implement your logic to update the user's chat credits or subscription based on the productId
    // Example:
    // await addChatsToUser(userId, productId);
}
