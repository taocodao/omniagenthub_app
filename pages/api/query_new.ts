import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

const indexName = 'omnisharing';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        // Existing query handling
        const { website, query, chatHistory } = req.body;

        try {
            const normalizedWebsite = website.toLowerCase().replace(/\/$/, '');
            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: query,
            });

            const queryEmbedding = embeddingResponse.data[0].embedding;
            const index = pinecone.Index(indexName);

            const pineResponse = await index.query({
                vector: queryEmbedding,
                topK: 8, // Increased from 5 to get more context
                includeMetadata: true,
                filter: { url: { $eq: normalizedWebsite } },
            });

            const references: Record<number, string> = {};
            pineResponse.matches?.forEach((match, index) => {
                const url = match.metadata?.url;
                if (typeof url === 'string') {
                    references[index + 1] = url;
                }
            });

            const context = pineResponse.matches?.map((m) => m.metadata?.text).join('\n') || '';

            // Improved system prompt with better instructions
            const systemPrompt = `You are a helpful AI assistant that answers questions based on website content. 

CONTEXT FROM WEBSITE:
${context}

INSTRUCTIONS:
1. Use the provided context to answer the user's question as thoroughly and helpfully as possible
2. If the context contains relevant information, use it to provide a comprehensive answer
3. If the context only partially relates to the question, use what's available and clearly explain what information you can provide
4. You can make reasonable inferences and connections from the available context
5. If the context contains related topics or background information, use it to provide helpful context in your answer
6. Only respond with "I don't have enough information to answer that question based on the available content" if the context is completely unrelated or empty
7. When possible, provide additional helpful suggestions or related information from the context
8. Keep your answers informative, accurate, and based on the provided context
9. If asked about specific details not in the context, acknowledge what you can't find while still providing related information that is available

Remember: Your goal is to be as helpful as possible using the available information.`;

            const updatedChatHistory = [
                ...chatHistory,
                {
                    role: 'system',
                    content: systemPrompt
                },
                { role: 'user', content: query }
            ];

            const chatResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: updatedChatHistory,
                max_tokens: 800, // Increased token limit for more comprehensive answers
                temperature: 0.7, // Slightly more creative responses
            });

            return res.status(200).json({
                answer: chatResponse.choices[0].message.content,
                references,
                contextFound: context.length > 0 // Added to help debug context issues
            });
        } catch (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
    } else if (req.method === 'GET') {
        // Improved common questions endpoint
        try {
            const website = req.query.website as string;

            if (!website) {
                return res.status(400).json({ error: 'Website parameter is required' });
            }

            const normalizedWebsite = website.toLowerCase().replace(/\/$/, '');

            // Better prompt for getting diverse context
            const contextPrompt = "website content overview common questions FAQ information services products features";
            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: contextPrompt,
            });

            const queryEmbedding = embeddingResponse.data[0].embedding;
            const index = pinecone.Index(indexName);

            const pineResponse = await index.query({
                vector: queryEmbedding,
                topK: 10, // Get more context for better question generation
                includeMetadata: true,
                filter: { url: { $eq: normalizedWebsite } },
            });

            const context = pineResponse.matches?.map((m) => m.metadata?.text).join('\n') || '';

            if (!context.trim()) {
                return res.status(200).json({
                    questions: [
                        "What services do you offer?",
                        "How can I contact you?",
                        "What are your business hours?",
                        "Where are you located?",
                        "What makes you different from competitors?",
                        "How much do your services cost?",
                        "Do you offer free consultations?",
                        "What is your experience in this field?"
                    ]
                });
            }

            const questionsPrompt = `Based on the following website content, generate 12 diverse and practical questions that visitors would commonly ask. Make the questions specific, relevant, and varied to cover different aspects of the business.

Website Content:
${context}

Generate questions that cover:
- Services/products offered
- Pricing and costs
- Process and how things work
- Company information and experience
- Contact and location details
- Unique features or benefits
- Support and customer service
- Getting started or next steps

Format: Return only the questions, one per line, without numbering or bullet points.`;

            const questionsResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'You are an expert at creating relevant, practical questions that website visitors would ask.'
                }, {
                    role: 'user',
                    content: questionsPrompt
                }],
                max_tokens: 400,
                temperature: 0.8, // More creative for diverse questions
            });

            const questions = questionsResponse.choices[0].message.content
                ?.split('\n')
                .map(q => q.trim())
                .filter(q => q.length > 10) // Filter out very short responses
                .slice(0, 8) || [];

            // Fallback questions if generation fails
            if (questions.length < 4) {
                questions.push(
                    "What services do you provide?",
                    "How can I get in touch with you?",
                    "What are your pricing options?",
                    "How do I get started?"
                );
            }

            return res.status(200).json({
                questions: questions.slice(0, 8),
                contextAvailable: context.length > 0
            });
        } catch (error) {
            console.error('Error generating questions:', error);
            return res.status(500).json({
                error: 'Error generating questions',
                questions: [
                    "What services do you offer?",
                    "How can I contact you?",
                    "What are your business hours?",
                    "Where are you located?"
                ]
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
