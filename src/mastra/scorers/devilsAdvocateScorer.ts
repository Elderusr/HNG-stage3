import { z } from 'zod';
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/code';
import { createCompletenessScorer } from '@mastra/evals/scorers/code';
import { createScorer } from '@mastra/core/scores';

export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'competitor-search-tool',
  strictMode: false,
});

export const completenessScorer = createCompletenessScorer();

// Custom LLM-judged scorer: evaluates if the agent properly used competitor search
export const competitorResearchScorer = createScorer({
  name: 'Competitor Research Quality',
  description:
    'Checks that the agent appropriately searched for and cited actual competitors',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions:
      'You are an expert evaluator of competitive analysis quality. ' +
      'Determine whether the assistant properly researched competitors and included specific, real competitor names in its analysis. ' +
      'Check if competitor information is substantive (not generic) and relevant to the user\'s idea. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = (run.input?.inputMessages?.[0]?.content as string) || '';
    const assistantText = (run.output?.[0]?.content as string) || '';
    return { userText, assistantText };
  })
  .analyze({
    description:
      'Extract and evaluate competitor mentions and research quality',
    outputSchema: z.object({
      competitorsFound: z.boolean(),
      specificNames: z.boolean(),
      relevantToIdea: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
You are evaluating if a devil's advocate agent properly researched and cited competitors.

User's business idea:
"""
${results.preprocessStepResult.userText}
"""

Assistant's analysis:
"""
${results.preprocessStepResult.assistantText}
"""

Tasks:
1) Identify if the assistant mentioned any competitors or competitive threats.
2) Check if specific competitor names are included (not just generic phrases like "competitors exist").
3) Evaluate if the competitor information is relevant to the user's specific idea.
4) Assess overall quality of competitive research.

Return JSON with fields:
{
  "competitorsFound": boolean,  // Did the assistant mention competitors at all?
  "specificNames": boolean,      // Are actual company/product names included?
  "relevantToIdea": boolean,     // Is the competitive analysis relevant and substantive?
  "confidence": number,          // 0-1, your confidence in this assessment
  "explanation": string          // Brief explanation of your evaluation
}
        `,
  })
  .generateScore(({ results }) => {
    try {
      const r = (results as any)?.analyzeStepResult;

      // Validate analyzeStepResult
      if (!r || typeof r !== 'object') {
        throw new Error('Invalid analyze step result: expected a non-null object');
      }
      
      if (typeof r.competitorsFound !== 'boolean' || typeof r.specificNames !== 'boolean' || typeof r.relevantToIdea !== 'boolean') {
        throw new Error('Invalid analyze step result: missing or invalid boolean fields');
      }

      if (!r.competitorsFound) return 0.3; // Minimal score if no competitors mentioned
      if (!r.specificNames) return 0.5; // Partial credit for generic competitive analysis
      if (!r.relevantToIdea) return 0.6; // Names found but not well-applied
      
      // Full competitive analysis with specific, relevant names
      const confidence = typeof r.confidence === 'number' ? r.confidence : 1;
      return Math.max(0, Math.min(1, 0.8 + 0.2 * confidence));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate score for competitor research: ${error.message}`);
      }
      throw new Error(`Unknown error occurred while generating score for competitor research: ${String(error)}`);
    }
  })
  .generateReason(({ results, score }) => {
    try {
      const r = (results as any)?.analyzeStepResult;

      // Validate analyzeStepResult
      if (!r || typeof r !== 'object') {
        throw new Error('Invalid analyze step result: expected a non-null object');
      }

      const competitorsFound = r.competitorsFound ?? false;
      const specificNames = r.specificNames ?? false;
      const relevantToIdea = r.relevantToIdea ?? false;
      const confidence = r.confidence ?? 0;
      const explanation = r.explanation ?? '';

      return `Competitor research scoring: competitorsFound=${competitorsFound}, specificNames=${specificNames}, relevantToIdea=${relevantToIdea}, confidence=${confidence}. Score=${score}. ${explanation}`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate reason for competitor research: ${error.message}`);
      }
      throw new Error(`Unknown error occurred while generating reason for competitor research: ${String(error)}`);
    }
  });

// Custom LLM-judged scorer: evaluates critical thinking depth
export const criticalAnalysisDepthScorer = createScorer({
  name: 'Critical Analysis Depth',
  description:
    'Evaluates if the devil\'s advocate provided thorough, multi-dimensional criticism',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-pro',
    instructions:
      'You are an expert evaluator of critical analysis quality. ' +
      'Determine whether the assistant covered multiple dimensions of criticism as specified in its instructions: ' +
      'flawed assumptions, market risks, competitor threats, operational hurdles, financial vulnerabilities, and customer reaction risks. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = (run.input?.inputMessages?.[0]?.content as string) || '';
    const assistantText = (run.output?.[0]?.content as string) || '';
    return { userText, assistantText };
  })
  .analyze({
    description:
      'Evaluate coverage of required critical analysis dimensions',
    outputSchema: z.object({
      flawedAssumptions: z.boolean(),
      marketRisks: z.boolean(),
      competitorThreats: z.boolean(),
      operationalHurdles: z.boolean(),
      financialVulnerabilities: z.boolean(),
      customerReactionRisks: z.boolean(),
      overallDepth: z.number().min(0).max(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
You are evaluating if a devil's advocate agent provided comprehensive critical analysis.

User's business idea:
"""
${results.preprocessStepResult.userText}
"""

Assistant's critical analysis:
"""
${results.preprocessStepResult.assistantText}
"""

The agent is instructed to cover these dimensions:
1. Flawed Assumptions: Unstated beliefs that might be wrong
2. Market Risks: Market size, saturation, or decline issues
3. Competitor Threats: Existing players and competitive risks
4. Operational Hurdles: Practical, real-world challenges
5. Financial Vulnerabilities: Where money could be lost
6. Customer Reaction Risks: How it could backfire with customers

Tasks:
Evaluate if the assistant meaningfully addressed each dimension. Mark true if the dimension is covered with substance (not just mentioned in passing).

Return JSON with fields:
{
  "flawedAssumptions": boolean,
  "marketRisks": boolean,
  "competitorThreats": boolean,
  "operationalHurdles": boolean,
  "financialVulnerabilities": boolean,
  "customerReactionRisks": boolean,
  "overallDepth": number,  // 0-1, overall quality and depth
  "explanation": string
}
        `,
  })
  .generateScore(({ results }) => {
    try {
      const r = (results as any)?.analyzeStepResult;

      // Validate analyzeStepResult
      if (!r || typeof r !== 'object') {
        throw new Error('Invalid analyze step result: expected a non-null object');
      }

      // Count how many dimensions were covered
      const dimensionsCovered = [
        r.flawedAssumptions,
        r.marketRisks,
        r.competitorThreats,
        r.operationalHurdles,
        r.financialVulnerabilities,
        r.customerReactionRisks,
      ].filter(Boolean).length;
      
      const coverageScore = dimensionsCovered / 6;
      const depthScore = typeof r.overallDepth === 'number' ? r.overallDepth : 0.5;
      
      // Weighted average: 60% coverage, 40% depth
      return Math.max(0, Math.min(1, coverageScore * 0.6 + depthScore * 0.4));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate score for critical analysis depth: ${error.message}`);
      }
      throw new Error(`Unknown error occurred while generating score for critical analysis depth: ${String(error)}`);
    }
  })
  .generateReason(({ results, score }) => {
    try {
      const r = (results as any)?.analyzeStepResult;

      // Validate analyzeStepResult
      if (!r || typeof r !== 'object') {
        throw new Error('Invalid analyze step result: expected a non-null object');
      }

      const dimensions = [
        r.flawedAssumptions && 'Flawed Assumptions',
        r.marketRisks && 'Market Risks',
        r.competitorThreats && 'Competitor Threats',
        r.operationalHurdles && 'Operational Hurdles',
        r.financialVulnerabilities && 'Financial Vulnerabilities',
        r.customerReactionRisks && 'Customer Reaction Risks',
      ].filter(Boolean).join(', ');
      
      const overallDepth = r.overallDepth ?? 0;
      const explanation = r.explanation ?? '';

      return `Critical analysis depth: Covered dimensions: [${dimensions}]. Overall depth=${overallDepth}. Score=${score}. ${explanation}`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate reason for critical analysis depth: ${error.message}`);
      }
      throw new Error(`Unknown error occurred while generating reason for critical analysis depth: ${String(error)}`);
    }
  });

export const scorers = {
  toolCallAppropriatenessScorer,
  completenessScorer,
  competitorResearchScorer,
  criticalAnalysisDepthScorer,
};