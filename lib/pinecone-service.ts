// lib/pinecone-service.ts
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

interface ContentChunk {
  content: string;
  source: string;
  metadata: {
    type: string;
    index: number;
    notebookTitle: string;
  };
}

interface Vector {
  id: string;
  values: number[];
  metadata: {
    content: string;
    source: string;
    notebook_id: string;
    notebook_title: string;
    chunk_index: number;
    created_at: string;
    content_type: string;
  };
}

export class PineconeService {
  private pinecone: Pinecone | null = null;
  private openai: OpenAI;
  private index: any = null;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async initialize(): Promise<void> {
    try {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
      });

      this.index = this.pinecone.index(process.env.PINECONE_INDEX_NAME!);
      console.log('Pinecone initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Pinecone:', error);
      throw new Error('Pinecone initialization failed');
    }
  }

  async chunkContent(content: any[], notebookTitle: string): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    const maxChunkSize = 1000;
    const overlapSize = 200;

    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      const text = item.content || item.text || String(item);
      const source = item.source || item.title || `Source ${i + 1}`;
      const type = item.type || 'text';

      if (text.length <= maxChunkSize) {
        chunks.push({
          content: text,
          source: source,
          metadata: {
            type: type,
            index: chunks.length,
            notebookTitle: notebookTitle
          }
        });
      } else {
        // Split long content into overlapping chunks
        for (let start = 0; start < text.length; start += maxChunkSize - overlapSize) {
          const end = Math.min(start + maxChunkSize, text.length);
          const chunkText = text.slice(start, end);

          chunks.push({
            content: chunkText,
            source: `${source} (Part ${Math.floor(start / (maxChunkSize - overlapSize)) + 1})`,
            metadata: {
              type: type,
              index: chunks.length,
              notebookTitle: notebookTitle
            }
          });

          if (end >= text.length) break;
        }
      }
    }

    return chunks;
  }

  async generateEmbeddings(chunks: ContentChunk[], notebookId: string, notebookTitle: string): Promise<Vector[]> {
    const vectors: Vector[] = [];
    const batchSize = 100; // Process in batches to avoid rate limits

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.content);

      try {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: texts,
        });

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = response.data[j].embedding;

          vectors.push({
            id: `${notebookId}_chunk_${i + j}`,
            values: embedding,
            metadata: {
              content: chunk.content,
              source: chunk.source,
              notebook_id: notebookId,
              notebook_title: notebookTitle,
              chunk_index: chunk.metadata.index,
              created_at: new Date().toISOString(),
              content_type: chunk.metadata.type
            }
          });
        }

        // Add delay between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`Failed to generate embeddings for batch ${i}:`, error);
        throw error;
      }
    }

    return vectors;
  }

  async upsertVectors(vectors: Vector[]): Promise<void> {
    if (!this.index) {
      throw new Error('Pinecone index not initialized');
    }

    const batchSize = 100; // Pinecone batch limit

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);

      try {
        await this.index.upsert(batch);
        console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
      } catch (error) {
        console.error(`Failed to upsert batch ${i}:`, error);
        throw error;
      }

      // Add delay between batches
      if (i + batchSize < vectors.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  async queryVectors(query: string, topK = 10, filter?: any): Promise<any> {
    if (!this.index) {
      throw new Error('Pinecone index not initialized');
    }

    // Generate embedding for the query
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    });

    const queryVector = response.data[0].embedding;

    // Query Pinecone
    const queryResponse = await this.index.query({
      vector: queryVector,
      topK: topK,
      includeMetadata: true,
      filter: filter
    });

    return queryResponse.matches;
  }
}
