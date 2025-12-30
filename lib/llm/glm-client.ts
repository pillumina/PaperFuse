/**
 * GLM (ZhipuAI) Client Implementation
 */

import { ZhipuAI } from 'zhipuai';
import type {
  ChatCompletionUserMessageParams,
  ChatCompletionAssistantMessageParams,
  ChatCompletionSystemMessageParams,
} from 'zhipuai';
import { LLMMessage, LLMResponse } from './types';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxAttempts: 10,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'],
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
  // Check for ZhipuAI SDK error with status code
  const zhipuError = error as { status?: number; code?: string; message?: string };
  if (zhipuError.status && RETRY_CONFIG.retryableStatusCodes.includes(zhipuError.status)) {
    return true;
  }

  // Check for network errors
  if (zhipuError.code && RETRY_CONFIG.retryableErrors.includes(zhipuError.code)) {
    return true;
  }

  // Check error message for common retryable patterns
  const message = zhipuError.message?.toLowerCase() || '';
  const retryablePatterns = [
    'rate limit',
    'too many requests',
    'quota exceeded',
    'temporary',
    'timeout',
    'service unavailable',
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}

// Initialize ZhipuAI client
let glmClient: ZhipuAI | null = null;

function getGLMClient() {
  if (!glmClient) {
    const apiKey = process.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      throw new Error('ZHIPUAI_API_KEY environment variable is not set');
    }
    glmClient = new ZhipuAI({ apiKey });
  }
  return glmClient;
}

/**
 * Convert LLMMessage to GLM format
 */
function convertToGLMMessage(message: LLMMessage):
  | ChatCompletionUserMessageParams
  | ChatCompletionAssistantMessageParams
  | ChatCompletionSystemMessageParams {
  if (message.role === 'system') {
    return { role: 'system', content: message.content };
  } else if (message.role === 'assistant') {
    return { role: 'assistant', content: message.content };
  } else {
    return { role: 'user', content: message.content };
  }
}

/**
 * Call GLM API with retry logic
 */
export async function callGLM(
  messages: LLMMessage[],
  model: string = 'glm-4-flash',
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  } = {}
): Promise<LLMResponse> {
  const client = getGLMClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      // Convert messages to GLM format
      const glmMessages = messages.map(convertToGLMMessage);

      const response = await client.chat.completions.create({
        model,
        messages: glmMessages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 0.7,
      });

      const content = response.choices[0]?.message?.content || '';

      return {
        content,
        model,
        provider: 'glm',
      };
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        console.error('GLM API error (non-retryable):', error);
        throw new Error(`GLM API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Log retry attempt
      const zhipuError = error as { status?: number; message?: string };
      const statusCode = zhipuError.status || 'unknown';
      const errorMessage = zhipuError.message || 'Unknown error';

      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const delay = calculateRetryDelay(attempt);
        console.warn(`GLM API error (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts}):`, {
          status: statusCode,
          message: errorMessage,
          retryingIn: `${Math.round(delay / 1000)}s`,
        });

        await sleep(delay);
      } else {
        console.error(`GLM API error: failed after ${RETRY_CONFIG.maxAttempts} attempts`, {
          status: statusCode,
          message: errorMessage,
        });
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `GLM API call failed after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
  );
}

/**
 * Stream GLM response (optional for future use)
 */
export async function* streamGLM(
  messages: LLMMessage[],
  model: string = 'glm-4-flash'
): AsyncGenerator<string, void, unknown> {
  const client = getGLMClient();

  const glmMessages = messages.map(convertToGLMMessage);

  const stream = await client.chat.completions.create({
    model,
    messages: glmMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
