// pages/api/create-checkout-session.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Initialize Stripe with your secret key and latest API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2024-09-30.acacia',
});

interface Product {
    id: number;
    title: string;
    priceId: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const { priceId, userId, productId, couponCode } = req.body;

            if (!priceId || !userId || !productId) {
                return res.status(400).json({ error: 'Missing required parameters.' });
            }

            let discounts;
            if (couponCode) {
                try {
                    const promotionCodes = await stripe.promotionCodes.list({
                        code: couponCode,
                        active: true,
                        limit: 1
                    });

                    if (promotionCodes.data.length > 0) {
                        discounts = [{ promotion_code: promotionCodes.data[0].id }];
                    } else {
                        throw new Error('Promotion code not found');
                    }
                } catch (couponError) {
                    console.error('Invalid promotion code:', couponError);
                    return res.status(400).json({ error: 'Invalid promotion code.' });
                }
            }


            const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'payment',
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${req.headers.origin}/cancel`,
                metadata: {
                    userId,
                    productId,
                },
                discounts: discounts,
            });

            res.status(200).json({ url: session.url });
        } catch (error: any) {
            console.error('Error creating Stripe Checkout session:', error);

            if (error.type === 'StripeInvalidRequestError') {
                return res.status(400).json({ error: 'Invalid parameters or Stripe configuration.' });
            }

            res.status(500).json({ error: 'Internal Server Error. Please try again later.' });
        }
    } else {
        res.setHeader('Allow', 'POST');
        res.status(405).end('Method Not Allowed');
    }
}
