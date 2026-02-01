// app/api/chatbot/route.ts

import { NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { ScoredPineconeRecord } from '@pinecone-database/pinecone';

export const runtime = 'edge';

interface MatchMetadata {
    [key: string]: any;
    department?: string;
    role?: string;
    task?: string;
    description?: string;
}

interface SearchRequestBody {
    query: string;
    department?: string;
    role?: string;
}

interface SearchResult {
    department: string;
    role: string;
    task: string;
    score: number;
}

export async function POST(req: NextRequest) {
    try {
        // Parse the request body
        const { query, department, role } = (await req.json()) as SearchRequestBody;

        // Validate the 'query' parameter
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: "Invalid request format. 'query' must be a non-empty string." }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Validate 'department' and 'role' if provided
        if (department && typeof department !== 'string') {
            return new Response(
                JSON.stringify({ error: "'department' must be a string." }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (role && typeof role !== 'string') {
            return new Response(
                JSON.stringify({ error: "'role' must be a string." }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Initialize OpenAI client
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

        // Initialize Pinecone client
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });

        // Get the Pinecone index
        const index = pinecone.index('task-descriptions'); // Ensure this index exists in Pinecone

        // Step 1: Embed the user's query
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: [query],
        });

        // Check if embedding was successful
        if (
            !embeddingResponse.data ||
            !Array.isArray(embeddingResponse.data) ||
            embeddingResponse.data.length === 0 ||
            !embeddingResponse.data[0].embedding
        ) {
            return new Response(
                JSON.stringify({ error: "Failed to generate embedding for the query." }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const userEmbedding = embeddingResponse.data[0].embedding;

        // Step 2: Construct the filter based on provided parameters
        let filter: any = {};

        if (department && role) {
            // If both department and role are provided, use $and to ensure both match
            filter = {
                "$and": [
                    { "department": { "$eq": department } },
                    { "role": { "$eq": role } }
                ]
            };
        } else if (department) {
            // Only department provided
            filter = {
                "department": { "$eq": department }
            };
        } // If neither is provided, no filter is applied

        // Step 3: Query Pinecone for relevant task descriptions
        const queryParams: any = {
            vector: userEmbedding,
            topK: 5, // Number of top matches to retrieve
            includeMetadata: true,
            includeValues: false, // We don't need the vector values in the response
        };

        if (department || role) {
            queryParams.filter = filter;
        }

        const queryResponse = await index.query(queryParams);

        // Check if any matches were found
        if (!queryResponse.matches || queryResponse.matches.length === 0) {
            return new Response(
                JSON.stringify({ message: "No matching tasks found." }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Step 4: Extract and sort the matches
        const results: SearchResult[] = queryResponse.matches
            .map((match: ScoredPineconeRecord<MatchMetadata>) => {
                return {
                    department: match.metadata?.department || 'Unknown Department',
                    role: match.metadata?.role || 'Unknown Role',
                    task: match.metadata?.task || 'Unknown Task',
                    score: match.score ?? 0, // Assign 0 if score is undefined
                };
            })
            .sort((a, b) => b.score - a.score); // Sort by highest score first

        // Step 5: Return the results
        return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error in chatbot handler:', error);

        // Generic error message
        return new Response(
            JSON.stringify({ error: "Internal server error. Please try again later." }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
