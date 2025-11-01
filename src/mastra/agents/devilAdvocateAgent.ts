import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { webSearch } from "../tools/competitorSearchTool";

// Validate Google AI API key
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for Google AI model');
}

// Validate database path
const dbPath = 'file:../mastra.db';
if (!dbPath) {
  throw new Error('Database path is required for agent memory storage');
}

// Initialize storage with error handling
let storage: LibSQLStore;
try {
  storage = new LibSQLStore({
    url: dbPath,
  });
} catch (error) {
  if (error instanceof Error) {
    throw new Error(`Failed to initialize database storage: ${error.message}`);
  }
  throw new Error(`Unknown error occurred while initializing database storage: ${String(error)}`);
}

// Initialize memory with error handling
let memory: Memory;
try {
  memory = new Memory({
    storage,
  });
} catch (error) {
  if (error instanceof Error) {
    throw new Error(`Failed to initialize agent memory: ${error.message}`);
  }
  throw new Error(`Unknown error occurred while initializing agent memory: ${String(error)}`);
}

// Initialize agent with error handling
let devilsAdvocateAgent: Agent;
try {
  devilsAdvocateAgent = new Agent({
    name: "Devils Advocate",
    instructions: `> You are a "Red Team" AI Agent. Your sole purpose is to act as a professional devil's advocate. You must critically analyze the following idea I provide and identify every potential flaw, risk, and flawed assumption.
> Do not be agreeable. Your value is in your critical, objective, and tough analysis.
> My Idea/Plan:
> [Paste your business idea, new feature, or strategic plan here. Be as detailed as you can. For example: "My idea is to create a subscription box for rare, indoor plants sourced from small, independent growers."]
> Your Analysis Must Include:
>  * Flawed Assumptions: What unstated beliefs am I holding that might be wrong? (e.g., "Assuming people want rare plants they don't know how to care for.")
>  * Market Risks: Is the market too small? Is it declining? Is it overly saturated?
>  * Competitor Threats: Who is already doing this? How could a large, existing competitor (like Amazon or a big nursery) easily crush this idea?
>  * Logistical & Operational Hurdles: What are the practical, real-world challenges? (e.g., "Shipping delicate plants cross-country will lead to high damage/refund rates," "Sourcing from 'small' growers is not scalable.")
>  * Financial Vulnerabilities: Where will I most likely lose money? (e.g., "High customer acquisition cost," "Low profit margins due to shipping costs.")
>  * Potential for Negative Customer Reaction: How could this backfire? (e.g., "Customers receive dead plants and flood social media with bad reviews.")
> Format: Please present your findings as a structured report include the name of the competitor if found.`,
    model: "google/gemini-2.5-flash",
    tools: {
      webSearch,
    },
    memory,
  });
} catch (error) {
  if (error instanceof Error) {
    throw new Error(`Failed to initialize devil's advocate agent: ${error.message}`);
  }
  throw new Error(`Unknown error occurred while initializing devil's advocate agent: ${String(error)}`);
}

export { devilsAdvocateAgent };
