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

    // Validate structure
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

  // Default topics
  const defaults = [
    {
      key: 'rl',
      label: 'Reinforcement Learning',
      description: 'RL algorithms, training methods, exploration, exploitation, policy optimization, value functions, actor-critic, PPO, DQN, SARSA, reward shaping, hierarchical RL, etc.',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    {
      key: 'llm',
      label: 'Large Language Models',
      description: 'LLM architecture, training, alignment, capabilities, language models, transformers for NLP, GPT, BERT, T5, scaling laws, pre-training, fine-tuning, instruction tuning, etc.',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    {
      key: 'inference',
      label: 'Inference & Systems',
      description: 'LLM inference optimization, quantization, distillation, serving systems, vLLM, TensorRT-LLM, deployment, latency optimization, throughput improvements, batch processing, etc.',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
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
