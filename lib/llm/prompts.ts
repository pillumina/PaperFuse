import { TopicConfig, getTopics } from '../topics';

/**
 * Generate classification system prompt based on configured topics
 */
export function generateClassificationPrompt(): string {
  const topics = getTopics();

  const domainDescriptions = topics
    .map(t => `- **${t.key}**: ${t.label} - ${t.description}`)
    .join('\n');

  const validTags = topics.map(t => t.key).join(', ');

  return `You are an expert AI/ML research paper classifier.

Your task is to analyze a paper's title and abstract to determine which research domain(s) it belongs to.

Domains:
${domainDescriptions}

IMPORTANT:
- A paper CAN belong to MULTIPLE domains (e.g., an LLM paper using RLHF could be both "llm" and "rl")
- Only include domains you are confident about
- At least one tag must be provided
- If the paper doesn't clearly fit any domain, choose the closest match

Respond ONLY with a valid JSON object. No markdown, no code blocks, no extra text.

Example format:
{"tags":["llm","rl"],"confidence":"high","reasoning":"Paper discusses RLHF for language models"}

Valid tags are only: ${validTags}
Valid confidence values are only: high, medium, low`;
}

/**
 * Generate tag context for analysis
 */
export function generateTagContext(tags: string[]): string {
  const topics = getTopics();

  return tags
    .map(tag => {
      const topic = topics.find(t => t.key === tag);
      return topic ? `${topic.label} - ${topic.description}` : tag;
    })
    .join(' + ');
}

// Alias for backward compatibility
export const getTagContext = generateTagContext;

/**
 * Get fallback keywords for topic matching
 * Returns mapping of topic keys to their keyword patterns
 */
export function getTopicKeywords(): Record<string, string[]> {
  const topics = getTopics();

  // Extract keywords from descriptions
  const keywords: Record<string, string[]> = {};

  for (const topic of topics) {
    // Split description by common delimiters and extract key phrases
    const phrases = topic.description
      .split(/[,.]/)
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 2)
      .slice(0, 5); // Take first 5 meaningful phrases

    // Add the label itself
    keywords[topic.key] = [
      topic.label.toLowerCase(),
      ...phrases,
    ];
  }

  return keywords;
}

/**
 * Get ArXiv category hints for topics
 */
export function getArxivCategoryHints(): Record<string, string[]> {
  // Common ArXiv category to topic mappings
  return {
    rl: ['cs.ro', 'cs.sy', 'cs.RO', 'cs.AI'],
    llm: ['cs.cl', 'cs.ai', 'cs.CL', 'cs.AI', 'cs.lg'],
    inference: ['cs.dc', 'cs.ar', 'cs.DC', 'cs.AR', 'cs.lv'],
  };
}
