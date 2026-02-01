// pages/api/feedback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { VertexAI } from '@google-cloud/vertexai';
import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@vercel/kv';

// Initialize Vertex AI (Uses GCP credits)
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT!,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
});

const validationModel = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.Index('omnisharing');
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

/**
 * Validates an "Excellent" rating to prevent data poisoning.
 */
async function validateFeedback(query: string, response: string): Promise<{ isValid: boolean; score: number; reason: string }> {
    const prompt = `
    Task: Validate this AI response for quality assurance.
    User Query: "${query}"
    AI Response: "${response}"
    
    Evaluate on these criteria:
    1. Relevance: Does it directly answer the user's intent?
    2. Self-Consistency: Does it contradict itself?
    3. Safety: Does it contain harmful content or obvious hallucinations?
    
    Return JSON: { "score": number (0.0-1.0), "isValid": boolean (score > 0.7), "reason": "short explanation" }
    `;

    try {
        const result = await validationModel.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn('Validation failed, defaulting to quarantine', e);
        return { isValid: false, score: 0, reason: "Validation error" };
    }
}

/**
 * Analyzes "Not Helpful" feedback to extract failure patterns.
 */
async function analyzeFailure(query: string, response: string): Promise<{ failureMode: string; explanation: string }> {
    const prompt = `
    Task: Analyze why this AI response might have failed.
    User Query: "${query}"
    AI Response: "${response}"
    
    Categorize the failure into ONE of: "Hallucination", "Incomplete", "Irrelevant", "Tone", "Other".
    Return JSON: { "failureMode": "Category", "explanation": "Why it failed" }
    `;

    try {
        const result = await validationModel.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        return { failureMode: "Unknown", explanation: "Analysis failed" };
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { conversationId, query, response, rating, suggestion } = req.body;

    if (!query || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Log raw feedback
        const feedbackLog = {
            timestamp: new Date().toISOString(),
            conversationId,
            query,
            response,
            rating,
            suggestion,
        };
        await kv.lpush('feedback_logs', JSON.stringify(feedbackLog));

        // 2. TIER 2: Feedback Validation Pipeline
        if (rating === 'excellent') {
            const validation = await validateFeedback(query, response);

            // Placeholder vector (in production, use Vertex AI embeddings)
            const vector = new Array(1536).fill(0.1);

            if (validation.isValid) {
                await index.namespace('learned-positive').upsert([{
                    id: `pos_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    values: vector,
                    metadata: {
                        query,
                        response,
                        validationScore: validation.score,
                        confidenceLevel: 'high',
                        addedAt: new Date().toISOString()
                    }
                }]);
            } else {
                await index.namespace('quarantine').upsert([{
                    id: `quar_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    values: vector,
                    metadata: {
                        query,
                        response,
                        validationScore: validation.score,
                        reason: validation.reason,
                        addedAt: new Date().toISOString()
                    }
                }]);
            }
        }

        // 3. TIER 3: Negative Learning
        else if (rating === 'not-helpful') {
            const analysis = await analyzeFailure(query, response);
            const vector = new Array(1536).fill(0.1);

            await index.namespace('learned-negative').upsert([{
                id: `neg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                values: vector,
                metadata: {
                    query,
                    badResponse: response,
                    failureMode: analysis.failureMode,
                    explanation: analysis.explanation,
                    addedAt: new Date().toISOString()
                }
            }]);
        }

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Feedback error:', error);
        return res.status(500).json({ error: error.message });
    }
}
