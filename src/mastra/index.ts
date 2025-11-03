
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { devilsAdvocateAgent } from './agents/devilAdvocateAgent';
import { a2aAgentRoute } from './routes/a2aAgentRouter';

import { toolCallAppropriatenessScorer, completenessScorer, competitorResearchScorer } from './scorers/devilsAdvocateScorer';

export const mastra = new Mastra({
  agents: { devilsAdvocateAgent },
  scorers: { competitorResearchScorer, toolCallAppropriatenessScorer, completenessScorer },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false, 
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true }, 
  },
  server: {
    apiRoutes: [a2aAgentRoute]
  }
});
