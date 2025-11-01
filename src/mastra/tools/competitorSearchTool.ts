import { createTool } from "@mastra/core/tools";
import z from "zod";
import Exa from 'exa-js';

// Validate API key exists
if (!process.env.EXA_API_KEY) {
    throw new Error('EXA_API_KEY environment variable is required for competitor search tool');
}

export const exa = new Exa(process.env.EXA_API_KEY);
 
export const webSearch = createTool({
    id: 'competitor-search-tool',
    description: 'searches the web to find existing competitors',
    inputSchema: z.object({
        query: z.string()
            .min(1, 'Query must be at least 1 character long')
            .max(50, 'Query must be at most 50 characters long')
            .describe('The search query'),
    }),
    outputSchema: z.array(z.object({
        title: z.string().nullable(),
        url: z.string(),
        content: z.string(),
        publishedDate: z.string().optional(),
    })),
    execute: async ({ context }) => {
        try {
            // Validate input
            if (!context.query || typeof context.query !== 'string') {
                throw new Error('Invalid query parameter: query must be a non-empty string');
            }

            const { results } = await exa.search(
                context.query,
                {
                    numResults: 10,
                }
            );

            if (!results || !Array.isArray(results)) {
                throw new Error('Invalid response from Exa API: results array expected');
            }

            return results.map(result => ({
                title: result.title || null,
                url: result.url || '',
                content: (result.text ?? '').slice(0, 500),
                publishedDate: result.publishedDate,
            })).filter(result => result.url); // Filter out results without URLs

        } catch (error) {
            if (error instanceof Error) {
                // Handle specific Exa API errors
                if (error.message.includes('API key') || error.message.includes('authentication')) {
                    throw new Error(`Authentication failed with Exa API: ${error.message}`);
                }
                if (error.message.includes('rate limit')) {
                    throw new Error(`Rate limit exceeded with Exa API: ${error.message}`);
                }
                if (error.message.includes('network')) {
                    throw new Error(`Network error with Exa API: ${error.message}`);
                }
                throw new Error(`Failed to search competitors: ${error.message}`);
            } else {
                throw new Error(`Unknown error occurred while searching competitors: ${String(error)}`);
            }
        }
    },
});