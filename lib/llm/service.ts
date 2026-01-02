/**
 * Unified LLM Service
 * Supports multiple providers (Claude, GLM) with a single interface
 */

import Anthropic from '@anthropic-ai/sdk';
import { callGLM } from './glm-client';
import {
  LLMProvider,
  LLMModel,
  LLMMessage,
  QuickScoreInput,
  QuickScoreResult,
  DeepAnalysisInput,
  DeepAnalysisResult,
  getApiModelName,
} from './types';
import { generateClassificationPrompt, generateTagContext, getTagContext, getTopicKeywords, getArxivCategoryHints } from './prompts';
import { getTopics, getTopicKeys, isValidTopic } from '../topics';
import { PaperTag } from '../db/types';

/**
 * Get default provider from environment
 */
export function getDefaultProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER as LLMProvider;
  return provider || 'claude'; // Default to Claude
}

/**
 * Get model for provider from environment or default
 */
export function getModelForProvider(provider: LLMProvider, type: 'quick' | 'deep'): string {
  const envVar = type === 'quick'
    ? `${provider.toUpperCase()}_QUICK_MODEL`
    : `${provider.toUpperCase()}_DEEP_MODEL`;

  const modelFromEnv = process.env[envVar] as LLMModel;
  if (modelFromEnv) {
    return modelFromEnv;
  }

  // Defaults (Updated 2025 for GLM-4.x series)
  const defaults: Record<LLMProvider, Record<'quick' | 'deep', string>> = {
    claude: { quick: 'claude-haiku', deep: 'claude-sonnet' },
    glm: { quick: 'glm-4.5-flash', deep: 'glm-4.7' },
  };

  return defaults[provider][type];
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxAttempts: 10,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  // Add random jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(exponentialDelay + jitter, RETRY_CONFIG.initialDelayMs);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Check for Anthropic error with status code
  const anthropicError = error as { status?: number; type?: string; message?: string };
  if (anthropicError.status && RETRY_CONFIG.retryableStatusCodes.includes(anthropicError.status)) {
    return true;
  }

  // Check error type/message for retryable patterns
  const type = anthropicError.type?.toLowerCase() || '';
  const message = anthropicError.message?.toLowerCase() || '';
  const retryablePatterns = [
    'rate_limit',
    'rate_limit_error',
    'overloaded',
    'temporarily unavailable',
    'timeout',
    'service unavailable',
  ];

  return retryablePatterns.some(pattern => type.includes(pattern) || message.includes(pattern));
}

/**
 * Call LLM based on provider with retry logic
 */
async function callLLM(
  messages: LLMMessage[],
  provider: LLMProvider,
  model: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  if (provider === 'claude') {
    return await callClaudeWithRetry(messages, model, options);
  } else if (provider === 'glm') {
    // GLM has its own retry logic in glm-client.ts
    const response = await callGLM(messages, model, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
    return response.content;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Call Claude API with retry logic
 */
async function callClaudeWithRetry(
  messages: LLMMessage[],
  model: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Find system message
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');

  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: getApiModelName('claude', model),
        max_tokens: options?.maxTokens ?? 2000,
        system: systemMessage,
        messages: userMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }
      return content.text;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        console.error('Claude API error (non-retryable):', error);
        throw error;
      }

      const claudeError = error as { status?: number; type?: string; message?: string };
      const statusCode = claudeError.status || 'unknown';
      const errorType = claudeError.type || 'unknown';
      const errorMessage = claudeError.message || 'Unknown error';

      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const delay = calculateRetryDelay(attempt);
        console.warn(`Claude API error (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts}):`, {
          status: statusCode,
          type: errorType,
          message: errorMessage,
          retryingIn: `${Math.round(delay / 1000)}s`,
        });

        await sleep(delay);
      } else {
        console.error(`Claude API error: failed after ${RETRY_CONFIG.maxAttempts} attempts`, {
          status: statusCode,
          type: errorType,
          message: errorMessage,
        });
      }
    }
  }

  throw lastError;
}

/**
 * Classify a paper into research domains
 */
export async function classifyPaper(
  input: { title: string; summary: string; categories: string[] },
  provider: LLMProvider = getDefaultProvider()
): Promise<{ tags: string[]; confidence: 'high' | 'medium' | 'low'; reasoning: string }> {
  const model = getModelForProvider(provider, 'quick');

  // Generate dynamic system prompt based on configured topics
  const systemPrompt = generateClassificationPrompt();

  const userMessage = `Title: ${input.title}

Abstract: ${input.summary}

ArXiv Categories: ${input.categories.join(', ')}

Classify this paper. Respond with ONLY a JSON object.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    provider,
    model,
    { maxTokens: 200, temperature: 0.1 }  // Lower temperature for more consistent output
  );

  return parseClassificationResponse(response, input.categories);
}

/**
 * Parse classification response
 */
function parseClassificationResponse(text: string, categories: string[]): {
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  // Get valid topic keys and keyword hints
  const validTopicKeys = getTopicKeys();
  const topicKeywords = getTopicKeywords();
  const arxivHints = getArxivCategoryHints();

  // Log raw response for debugging
  const trimmedText = text.trim();

  // Try to find JSON in the response
  let jsonText = trimmedText;

  // Try to extract JSON from code blocks
  const jsonCodeBlockMatch = trimmedText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonCodeBlockMatch) {
    jsonText = jsonCodeBlockMatch[1].trim();
    console.log('[Classification] Extracted JSON from code block');
  } else {
    // Try to find JSON object by looking for start and end braces
    const firstBrace = trimmedText.indexOf('{');
    const lastBrace = trimmedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = trimmedText.substring(firstBrace, lastBrace + 1);
      console.log('[Classification] Extracted JSON from response body');
    }
  }

  try {
    const parsed = JSON.parse(jsonText);
    console.log('[Classification] Successfully parsed JSON:', JSON.stringify(parsed));

    // Validate and filter tags against dynamic topic list
    let tags: string[] = [];
    if (Array.isArray(parsed.tags)) {
      tags = parsed.tags.filter((t: string) => validTopicKeys.includes(t));
    }

    // Ensure at least one tag
    if (tags.length === 0) {
      console.warn('[Classification] No valid tags found, defaulting to first topic');
      tags = [validTopicKeys[0]];
    }

    // Validate confidence
    const validConfidences = ['high', 'medium', 'low'];
    const confidence = validConfidences.includes(parsed.confidence) ? parsed.confidence : 'medium';

    return {
      tags,
      confidence,
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    console.error('[Classification] Failed to parse JSON response');
    console.error('[Classification] Raw response:', trimmedText.substring(0, 500));
    console.error('[Classification] Attempted to parse:', jsonText.substring(0, 300));
    console.error('[Classification] Parse error:', error);

    // Fallback: use keyword matching with dynamic topic keywords
    const combinedText = (trimmedText + ' ' + categories.join(' ')).toLowerCase();
    const tags: string[] = [];

    // Check each topic's keywords
    for (const topicKey of validTopicKeys) {
      const keywords = topicKeywords[topicKey] || [];

      // Check if any keyword matches
      if (keywords.some(kw => combinedText.includes(kw.toLowerCase()))) {
        tags.push(topicKey);
      }
    }

    // ArXiv category hints
    const catsLower = categories.join(' ').toLowerCase();
    for (const [topicKey, hints] of Object.entries(arxivHints)) {
      if (hints.some(hint => catsLower.includes(hint.toLowerCase()))) {
        if (!tags.includes(topicKey)) {
          tags.push(topicKey);
        }
      }
    }

    // Ensure at least one tag
    const fallbackTags: string[] = tags.length > 0 ? tags : [validTopicKeys[0]];
    console.log('[Classification] Fallback classification:', fallbackTags);

    return {
      tags: fallbackTags,
      confidence: 'low',
      reasoning: `LLM JSON parsing failed. Used keyword matching on: ${combinedText.substring(0, 100)}...`,
    };
  }
}

/**
 * Quick score a paper
 */
export async function quickScorePaper(
  input: QuickScoreInput,
  provider: LLMProvider = getDefaultProvider()
): Promise<QuickScoreResult> {
  const model = getModelForProvider(provider, 'quick');
  const tagContext = getTagContext(input.tags);

  const systemPrompt = `You are an expert research paper evaluator for ${tagContext}.

Your task is to quickly assess the value of a research paper and output a score from 1-10.

Scoring criteria:
- 9-10: Major breakthrough, novel approach, must-read for researchers
- 7-8: Solid contribution, useful insights, worth following
- 5-6: Incremental improvement, limited novelty
- 1-4: Minor work, poor quality, or not significant

Respond ONLY in this exact format:
Score: X/10
Reason: One sentence explaining the score`;

  const userMessage = `Title: ${input.title}

Abstract: ${input.summary}

Tags: ${input.tags.join(', ')}

Please evaluate this paper and provide a score.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    provider,
    model,
    { maxTokens: 200 }
  );

  return parseScoreResponse(response);
}

/**
 * Deep analyze a paper
 */
export async function deepAnalyzePaper(
  input: DeepAnalysisInput,
  provider: LLMProvider = getDefaultProvider()
): Promise<DeepAnalysisResult> {
  const model = getModelForProvider(provider, 'deep');
  const tagContext = getTagContext(input.tags);

  const systemPrompt = `You are an expert research analyst and engineer specializing in AI/ML papers.

Your task is to provide a comprehensive analysis of a research paper that helps researchers and engineers quickly understand:

1. **Core Contribution** - What problem does it solve? What's novel?
2. **Key Insights** - 3-5 bullet points of the most important takeaways
3. **Engineering Impact** - How can this be applied in practice? Which frameworks/projects could benefit?
4. **Code Availability** - Are there GitHub links, implementations, or related projects?

IMPORTANT:
- Be concise and specific
- Focus on practical value for engineers
- Mention specific frameworks when relevant (e.g., PyTorch, Hugging Face, vLLM, VERL)
- If the paper introduces a new algorithm or method, suggest where it could be integrated

Format your response as a JSON object with these exact keys:
{
  "ai_summary": "3-5 sentence summary",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "engineering_notes": "Practical applications and framework recommendations",
  "code_links": ["link1", "link2"] // or empty array if none
}`;

  const userMessage = `Tag Context: ${tagContext}

Title: ${input.title}

Abstract: ${input.summary}

${input.full_text ? `Full Paper Text: ${input.full_text.substring(0, 15000)}...` : ''}

Please analyze this paper and provide a comprehensive assessment in JSON format.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    provider,
    model,
    { maxTokens: 2000 }
  );

  return parseAnalysisResponse(response);
}

/**
 * Batch quick score
 */
export async function batchQuickScore(
  inputs: QuickScoreInput[],
  provider: LLMProvider = getDefaultProvider(),
  options: { concurrency?: number } = {}
): Promise<Map<string, QuickScoreResult>> {
  const { concurrency = 5 } = options;
  const results = new Map<string, QuickScoreResult>();

  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(input =>
        quickScorePaper(input, provider).then(result => ({ id: input.title, result }))
      )
    );

    for (const outcome of batchResults) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.id, outcome.value.result);
      } else {
        console.error('Batch scoring failed:', outcome.reason);
      }
    }

    if (i + concurrency < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Batch deep analyze
 */
export async function batchDeepAnalyze(
  inputs: DeepAnalysisInput[],
  provider: LLMProvider = getDefaultProvider(),
  options: { concurrency?: number } = {}
): Promise<Map<string, DeepAnalysisResult>> {
  const { concurrency = 3 } = options;
  const results = new Map<string, DeepAnalysisResult>();

  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(input =>
        deepAnalyzePaper(input, provider).then(result => ({ id: input.title, result }))
      )
    );

    for (const outcome of batchResults) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.id, outcome.value.result);
      } else {
        console.error('Batch analysis failed:', outcome.reason);
      }
    }

    if (i + concurrency < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Parse score response
 */
function parseScoreResponse(text: string): QuickScoreResult {
  const scoreMatch = text.match(/Score:\s*(\d+)/i);
  const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : 5;

  const reasonMatch = text.match(/Reason:\s*(.+?)(?:\n|$)/i);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

  return { score, reason };
}

/**
 * Parse analysis response
 */
function parseAnalysisResponse(text: string): DeepAnalysisResult {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return {
        ai_summary: parsed.ai_summary || '',
        key_insights: parsed.key_insights || [],
        engineering_notes: parsed.engineering_notes || '',
        code_links: parsed.code_links || [],
      };
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse analysis response:', error);
    return {
      ai_summary: extractSummary(text),
      key_insights: extractInsights(text),
      engineering_notes: '',
      code_links: [],
    };
  }
}

function extractSummary(text: string): string {
  const summaryMatch = text.match(/(?:ai_summary|summary):\s*(.+?)(?:\n|$|key_insights)/is);
  return summaryMatch ? summaryMatch[1].trim() : text.substring(0, 500);
}

function extractInsights(text: string): string[] {
  const insightsMatch = text.match(/(?:key_insights|insights):\s*\[([\s\S]*?)\]/);
  if (insightsMatch) {
    try {
      return JSON.parse(insightsMatch[1]);
    } catch {
      return [];
    }
  }

  const bulletMatches = text.matchAll(/^\s*[-*]\s*(.+)$/gm);
  return Array.from(bulletMatches).map(m => m[1].trim());
}

// Note: getTagContext is now imported from prompts.ts

