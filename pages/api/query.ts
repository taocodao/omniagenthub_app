import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  apiKey: process.env.OPENAI_API_KEY!,
});

const pinecone = new Pinecone({
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  apiKey: process.env.PINECONE_API_KEY!,
});

const indexName = 'omnisharing'; // Ensure this Pinecone index exists

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { website, query, chatHistory } = req.body;

  if (!website || !query || !Array.isArray(chatHistory)) {
    return res.status(400).json({ error: '"website", "query", or "chatHistory" is missing or invalid.' });
  }

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
      topK: 5,
      includeMetadata: true,
      filter: { url: { $eq: normalizedWebsite } },
    });

    // Extract URLs and map references dynamically
    const references: Record<number, string> = {}; // Explicitly define the type
    pineResponse.matches?.forEach((match, index) => {
      const url = match.metadata?.url;
      if (typeof url === 'string') {
        references[index + 1] = url; // Map reference numbers to URLs
      }
    });

    const context = pineResponse.matches?.map((m) => m.metadata?.text).join('\n') || '';

    const updatedChatHistory = [
      ...chatHistory,
      { role: 'system', 
        content: ` Use Context:\n${context}, if question not related then answer " I don't know"`, 
            },
      { role: 'user', content: query },
    ];

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedChatHistory,
      max_tokens: 500,
    });

    return res.status(200).json({ answer: chatResponse.choices[0].message.content, references });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error });
  }
}
