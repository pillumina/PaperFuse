/**
 * Unified LLM Provider Interface
 * Supports: Claude (Anthropic) and GLM (ZhipuAI)
 */

export type LLMProvider = 'claude' | 'glm';

export type LLMModel = 'claude-haiku' | 'claude-sonnet' | 'claude-opus'
  | 'glm-4.7'
  | 'glm-4.6'
  | 'glm-4.5'
  | 'glm-4.5-air'
  | 'glm-4.5-flash'
  | 'glm-4.5-x'
  | 'glm-4-airx'
  | 'glm-4-flashx-250414'
  | 'glm-4-flash-250414';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
}

export interface QuickScoreInput {
  title: string;
  summary: string;
  tags: string[];
}

export interface QuickScoreResult {
  score: number; // 1-10
  reason: string;
}

export interface DeepAnalysisInput {
  title: string;
  summary: string;
  tags: string[];
  full_text?: string;
}

export interface DeepAnalysisResult {
  ai_summary: string;
  key_insights: string[];
  engineering_notes: string;
  code_links: string[];
}

/**
 * Provider configurations (Updated 2025)
 */
export const PROVIDER_CONFIGS: Record<LLMProvider, {
  name: string;
  models: Record<string, { name: string; apiName: string; type: 'quick' | 'deep' }>;
  defaultQuickModel: string;
  defaultDeepModel: string;
}> = {
  claude: {
    name: 'Claude (Anthropic)',
    models: {
      'claude-haiku': { name: 'Claude 3 Haiku', apiName: 'claude-3-haiku-20240307', type: 'quick' },
      'claude-sonnet': { name: 'Claude 3.5 Sonnet', apiName: 'claude-3-5-sonnet-20241022', type: 'deep' },
      'claude-opus': { name: 'Claude 3 Opus', apiName: 'claude-3-opus-20240229', type: 'deep' },
    },
    defaultQuickModel: 'claude-haiku',
    defaultDeepModel: 'claude-sonnet',
  },
  glm: {
    name: 'GLM (ZhipuAI) - 2025 Models',
    models: {
      // Latest GLM-4.x models (2025)
      'glm-4.7': { name: 'GLM-4.7 (Flagship)', apiName: 'glm-4.7', type: 'deep' },
      'glm-4.6': { name: 'GLM-4.6 (Ultra)', apiName: 'glm-4.6', type: 'deep' },
      'glm-4.5': { name: 'GLM-4.5 (Pro)', apiName: 'glm-4.5', type: 'deep' },
      'glm-4.5-air': { name: 'GLM-4.5-Air (Value)', apiName: 'glm-4.5-air', type: 'quick' },
      'glm-4.5-flash': { name: 'GLM-4.5-Flash (FREE)', apiName: 'glm-4.5-flash', type: 'quick' },
      'glm-4.5-x': { name: 'GLM-4.5-X (Fast)', apiName: 'glm-4.5-x', type: 'quick' },
      'glm-4.5-airx': { name: 'GLM-4.5-AirX (Faster)', apiName: 'glm-4.5-airx', type: 'quick' },
      // Older models (still supported)
      'glm-4-flashx-250414': { name: 'GLM-4-FlashX (Legacy)', apiName: 'glm-4-flashx-250414', type: 'quick' },
      'glm-4-flash-250414': { name: 'GLM-4-Flash (Legacy)', apiName: 'glm-4-flash-250414', type: 'quick' },
    },
    // Default to free model for quick, flagship for deep
    defaultQuickModel: 'glm-4.5-flash',  // FREE model!
    defaultDeepModel: 'glm-4.7',          // Flagship
  },
};

/**
 * Get available models for a provider
 */
export function getModelsForProvider(provider: LLMProvider): Record<string, string> {
  const configs = PROVIDER_CONFIGS[provider].models;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(configs)) {
    result[key] = value.name;
  }
  return result;
}

/**
 * Get API model name
 */
export function getApiModelName(provider: LLMProvider, model: string): string {
  return PROVIDER_CONFIGS[provider].models[model]?.apiName || model;
}
