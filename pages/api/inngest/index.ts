// pages/api/inngest/index.ts
import { Inngest } from 'inngest';

// Initialize the Inngest client (export for reuse across your API routes)
export const inngest = new Inngest({
    id: 'web3aistore-background-jobs',
    // These will be automatically set by Vercel integration
    eventKey: process.env.INNGEST_EVENT_KEY,
    signedFetches: true
    //baseUrl: process.env.NEXT_PUBLIC_BASE_URL
    //     ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/inngest`
    //     : 'http://localhost:3000/api/inngest'
});
