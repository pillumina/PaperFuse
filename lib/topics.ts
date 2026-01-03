/**
 * Topics Configuration
 *
 * Manages research topic/domain configuration for paper classification and filtering.
 * Topics are loaded from environment variable TOPICS_CONFIG (JSON format)
 * or falls back to default configuration.
 */

export interface TopicConfig {
  /** Unique identifier stored in database */
  key: string;
  /** Display label shown in UI */
  label: string;
  /** Detailed description for classification prompt */
  description: string;
  /** Tailwind CSS color classes for badges */
  color: string;
  /** Optional: ArXiv categories for fetching (default: ['cs.AI', 'cs.LG']) */
  arxivCategories?: string[];
  /** Optional: Max papers per day (default: 10) */
  maxPapersPerDay?: number;
  /** Optional: Number of papers to deep analyze (default: 3) */
  deepAnalysisCount?: number;
  /** Optional: Quick score threshold for deep analysis (default: 7) */
  quickScoreThreshold?: number;
  /** Optional: Keywords for additional relevance filtering */
  keywords?: string[];
}

/**
 * Domain configuration derived from TopicConfig
 */
export interface DomainConfig {
  tag: string;
  arxivCategories: string[];
  maxPapersPerDay: number;
  deepAnalysisCount: number;
  quickScoreThreshold: number;
  keywords: string[];
}

/**
 * Parse TOPICS_CONFIG from environment variable
 */
function parseTopicsConfig(): TopicConfig[] | null {
  const envConfig = process.env.TOPICS_CONFIG;

  if (!envConfig) {
    return null;
  }

  try {
    // Handle multi-line JSON from .env files by removing newlines and extra spaces
    const normalizedConfig = envConfig
      .replace(/\n/g, ' ')  // Replace newlines with spaces
      .replace(/\s+/g, ' ')  // Collapse multiple spaces to single space
      .trim();              // Remove leading/trailing whitespace

    const parsed = JSON.parse(normalizedConfig);

    if (!Array.isArray(parsed)) {
      throw new Error('TOPICS_CONFIG must be an array');
    }

    // Validate structure and merge with defaults for optional fields
    const validated = parsed.map((item, index) => {
      if (!item.key || typeof item.key !== 'string') {
        throw new Error(`Topic at index ${index} missing or invalid 'key'`);
      }
      if (!item.label || typeof item.label !== 'string') {
        throw new Error(`Topic '${item.key}' missing or invalid 'label'`);
      }
      if (!item.description || typeof item.description !== 'string') {
        throw new Error(`Topic '${item.key}' missing or invalid 'description'`);
      }
      if (!item.color || typeof item.color !== 'string') {
        throw new Error(`Topic '${item.key}' missing or invalid 'color'`);
      }

      return {
        key: item.key,
        label: item.label,
        description: item.description,
        color: item.color,
        // Optional fields with defaults
        arxivCategories: item.arxivCategories || ['cs.AI', 'cs.LG'],
        maxPapersPerDay: item.maxPapersPerDay ?? 10,
        deepAnalysisCount: item.deepAnalysisCount ?? 3,
        quickScoreThreshold: item.quickScoreThreshold ?? 7,
        keywords: item.keywords || [],
      };
    });

    if (validated.length === 0) {
      throw new Error('TOPICS_CONFIG cannot be empty');
    }

    return validated;
  } catch (error) {
    console.error('[Topics] Failed to parse TOPICS_CONFIG from environment:', error);
    console.error('[Topics] Raw config value:', envConfig);
    return null;
  }
}

/**
 * Cache for topics to avoid hydration mismatches
 */
let cachedTopics: TopicConfig[] | null = null;

/**
 * Get all topic configurations
 * Falls back to default topics if not configured in environment
 */
export function getTopics(): TopicConfig[] {
  // Return cached topics if available (prevents hydration mismatches)
  if (cachedTopics) {
    return cachedTopics;
  }

  const fromEnv = parseTopicsConfig();

  if (fromEnv) {
    console.log('[Topics] Loaded', fromEnv.length, 'topics from environment variable');
    cachedTopics = fromEnv;
    return fromEnv;
  }

  // Default topics with full domain configuration
  const defaults: TopicConfig[] = [
    {
      key: 'rl',
      label: 'Reinforcement Learning',
      description: 'RL algorithms, training methods, exploration, exploitation, policy optimization, value functions, actor-critic, PPO, DQN, SARSA, reward shaping, hierarchical RL, etc.',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      arxivCategories: ['cs.AI', 'cs.LG', 'stat.ML'],
      maxPapersPerDay: 10,
      deepAnalysisCount: 3,
      quickScoreThreshold: 7,
      keywords: ['reinforcement', 'reinforcement learning', 'policy gradient', 'q-learning', 'actor-critic', 'ppo', 'dqn', 'rlhf', 'rlaif'],
    },
    {
      key: 'llm',
      label: 'Large Language Models',
      description: 'LLM architecture, training, alignment, capabilities, language models, transformers for NLP, GPT, BERT, T5, scaling laws, pre-training, fine-tuning, instruction tuning, etc.',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      arxivCategories: ['cs.AI', 'cs.CL', 'cs.LG'],
      maxPapersPerDay: 10,
      deepAnalysisCount: 3,
      quickScoreThreshold: 7,
      keywords: ['language model', 'llm', 'gpt', 'transformer', 'attention', 'pretraining', 'finetuning', 'alignment', 'llm inference', 'large language'],
    },
    {
      key: 'inference',
      label: 'Inference & Systems',
      description: 'LLM inference optimization, quantization, distillation, serving systems, vLLM, TensorRT-LLM, deployment, latency optimization, throughput improvements, batch processing, etc.',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      arxivCategories: ['cs.AI', 'cs.LG', 'cs.DC'],
      maxPapersPerDay: 8,
      deepAnalysisCount: 2,
      quickScoreThreshold: 8,
      keywords: ['inference', 'quantization', 'distillation', 'speculative', 'kv cache', 'acceleration', 'optimization', 'serving', 'latency', 'throughput'],
    },
  ];

  cachedTopics = defaults;
  return defaults;
}

/**
 * Get topic label by key
 */
export function getTopicLabel(key: string): string {
  const topics = getTopics();
  const topic = topics.find(t => t.key === key);
  return topic?.label || key;
}

/**
 * Get topic color by key
 */
export function getTopicColor(key: string): string {
  const topics = getTopics();
  const topic = topics.find(t => t.key === key);
  return topic?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

/**
 * Get all valid topic keys
 */
export function getTopicKeys(): string[] {
  return getTopics().map(t => t.key);
}

/**
 * Validate if a key is a valid topic
 */
export function isValidTopic(key: string): boolean {
  return getTopicKeys().includes(key);
}

/**
 * Get domain configuration for a specific topic
 * Returns null if topic not found
 */
export function getDomainConfig(tag: string): DomainConfig | null {
  const topics = getTopics();
  const topic = topics.find(t => t.key === tag);

  if (!topic) {
    return null;
  }

  return {
    tag: topic.key,
    arxivCategories: topic.arxivCategories || ['cs.AI', 'cs.LG'],
    maxPapersPerDay: topic.maxPapersPerDay ?? 10,
    deepAnalysisCount: topic.deepAnalysisCount ?? 3,
    quickScoreThreshold: topic.quickScoreThreshold ?? 7,
    keywords: topic.keywords || [],
  };
}

/**
 * Get all domain configurations
 */
export function getAllDomainConfigs(): DomainConfig[] {
  const topics = getTopics();
  return topics.map(topic => ({
    tag: topic.key,
    arxivCategories: topic.arxivCategories || ['cs.AI', 'cs.LG'],
    maxPapersPerDay: topic.maxPapersPerDay ?? 10,
    deepAnalysisCount: topic.deepAnalysisCount ?? 3,
    quickScoreThreshold: topic.quickScoreThreshold ?? 7,
    keywords: topic.keywords || [],
  }));
}
