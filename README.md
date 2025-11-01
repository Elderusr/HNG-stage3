# Devil's Advocate AI Agent

This project implements a "Devil's Advocate" AI agent designed to critically analyze business ideas, new features, or strategic plans. Built using the Mastra framework, this agent acts as a "Red Team" member, identifying potential flaws, risks, and flawed assumptions in a structured report.

## Features

*   **Critical Analysis**: Provides a tough, objective analysis of ideas.
*   **Multi-dimensional Criticism**: Evaluates ideas across several dimensions:
    *   Flawed Assumptions
    *   Market Risks
    *   Competitor Threats
    *   Logistical & Operational Hurdles
    *   Financial Vulnerabilities
    *   Potential for Negative Customer Reaction
*   **Competitor Research**: Utilizes web search to identify existing competitors and their potential impact.
*   **Scoring System**: Incorporates various scorers to evaluate the agent's performance, including:
    *   `Tool Call Appropriateness Scorer`: Checks if the agent appropriately used the competitor search tool.
    *   `Completeness Scorer`: Assesses the completeness of the agent's response.
    *   `Competitor Research Quality Scorer`: Evaluates the quality and relevance of competitor research.
    *   `Critical Analysis Depth Scorer`: Determines if the agent provided thorough, multi-dimensional criticism.

## Technologies Used

*   **Mastra Framework**: Core framework for building agentic applications.
*   **@ai-sdk/google**: Integrates with Google's Generative AI models (e.g., Gemini-2.5-Flash).
*   **@mastra/libsql**: Used for persistent storage of observability data and scores.
*   **exa-js**: Powers the web search functionality for competitor research.
*   **TypeScript**: The primary programming language.
*   **Zod**: Schema validation library.

## Setup

To run this project locally, follow these steps:

### Prerequisites

*   Node.js (LTS version recommended)
*   npm or yarn

### Environment Variables

You need to set up the following environment variables in a `.env` file in the project root:

*   `GOOGLE_GENERATIVE_AI_API_KEY`: Your API key for Google's Generative AI.
*   `EXA_API_KEY`: Your API key for Exa (web search).

Example `.env` file:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key_here
EXA_API_KEY=your_exa_api_key_here
```

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Elderusr/HNG-stage3
    cd HNG-stage3
    ```
2.  Install the dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

## How to Run Locally

### Development Mode

To run the agent in development mode, which typically involves a Mastra development server:

```bash
npm run dev
```

This command will likely start a local server or an interactive environment where you can provide input to the `Devils Advocate` agent. Refer to the Mastra documentation for specific instructions on how to interact with agents in development mode.

### Building the Project

To build the project for production:

```bash
npm run build```

This will compile the TypeScript code into JavaScript, typically outputting to a `dist` directory.

## Project Structure

*   `src/mastra/`: Contains the core Mastra agent definitions.
    *   `index.ts`: Initializes the Mastra application with agents, scorers, and storage.
    *   `agents/`: Defines the AI agents.
        *   `devilAdvocateAgent.ts`: Implements the "Devil's Advocate" agent, including its instructions, model, and tools.
    *   `scorers/`: Contains the custom and built-in scorers for evaluating agent performance.
        *   `devilsAdvocateScorer.ts`: Defines the `toolCallAppropriatenessScorer`, `completenessScorer`, `competitorResearchScorer`, and `criticalAnalysisDepthScorer`.
    *   `tools/`: Defines the tools available to the agents.
        *   `competitorSearchTool.ts`: Implements the `webSearch` tool using Exa for competitor research.