// pages/api/admin/metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { Pinecone } from '@pinecone-database/pinecone';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.Index('omnisharing');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 1. Fetch Feedback Logs (Last 100)
        const rawLogs = await kv.lrange('feedback_logs', 0, 99);
        const feedbackLogs = rawLogs.map((log: any) => typeof log === 'string' ? JSON.parse(log) : log);

        // 2. Calculate Feedback Health
        const feedbackStats = {
            total: feedbackLogs.length,
            excellent: feedbackLogs.filter((l: any) => l.rating === 'excellent').length,
            notHelpful: feedbackLogs.filter((l: any) => l.rating === 'not-helpful').length,
            ratio: 0
        };
        feedbackStats.ratio = feedbackStats.total ? (feedbackStats.excellent / feedbackStats.total) : 0;

        // 3. Fetch Learning Stats from Pinecone
        // Note: Pinecone list/stats operations are limited on free tier, using approximate counts or just checking namespace existence
        const indexStats = await index.describeIndexStats();

        const learnedStats = {
            positive: indexStats.namespaces?.['learned-positive']?.recordCount || 0,
            negative: indexStats.namespaces?.['learned-negative']?.recordCount || 0,
            quarantined: indexStats.namespaces?.['quarantine']?.recordCount || 0,
        };

        // 4. Determine QA Trend
        const recentLogs = feedbackLogs.slice(0, 10); // Last 10 interactions
        const recentExcellent = recentLogs.filter((l: any) => l.rating === 'excellent').length;
        const trend = recentExcellent > 7 ? 'Improving 🚀' : recentExcellent < 3 ? 'Degrading ⚠️' : 'Stable';

        const metrics = {
            systemStatus: 'Healthy',
            lastUpdated: new Date().toISOString(),
            trend,
            feedback: feedbackStats,
            knowledgeBase: learnedStats,
            recentLogs: feedbackLogs.slice(0, 5) // Show last 5 interactions
        };

        return res.status(200).json(metrics);
    } catch (error: any) {
        console.error('Metrics Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
