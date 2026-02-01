// pages/api/inngest/handler.ts
import { serve } from 'inngest/next';
import { inngest } from './index';
import { scrapeWebsite } from './functions/scrape-website';

// Export the Inngest handler
export default serve({
    client: inngest,
    functions: [scrapeWebsite],
});
