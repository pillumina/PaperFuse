import { ArxivPaper, ArxivFetchOptions, PaperTag } from '../db/types';
import { getDomainConfig } from '../topics';
import { getTopicKeys } from '../topics';

/**
 * ArXiv API Fetcher
 * Docs: http://export.arxiv.org/api_help/docs/user_manual.html
 */

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';

/**
 * Parse ArXiv ID from various formats
 * Handles: "2312.12345", "2312.12345v1", "arXiv:2312.12345"
 */
export function parseArxivId(rawId: string): string {
  return rawId.replace(/^arxiv:/i, '').replace(/v\d+$/, '');
}

/**
 * Fetch papers from ArXiv API
 */
export async function fetchArxivPapers(options: ArxivFetchOptions): Promise<ArxivPaper[]> {
  const {
    categories,
    maxResults = 100,
    daysBack = 1,
  } = options;

  // Calculate date range using UTC timestamps
  const now = Date.now();
  const daysBackMs = daysBack * 24 * 60 * 60 * 1000;
  const startDateTimestamp = now - daysBackMs;

  // Build search query for each category
  // ArXiv API doesn't have date filtering, so we fetch recent and filter client-side
  const categoryQuery = categories.map(cat => `cat:${cat}`).join(' OR ');

  // Build search parameters
  const params = new URLSearchParams({
    search_query: `(${categoryQuery})`,
    start: '0',
    max_results: String(maxResults),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
  });

  const url = `${ARXIV_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Paperfuse/1.0 (https://github.com/yourusername/paperfuse)',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`ArXiv API returned ${response.status}`);
    }

    const xmlText = await response.text();
    const papers = parseArxivXML(xmlText);

    // Filter by date range using UTC timestamps
    // ArXiv dates are in UTC format, so we compare timestamps directly
    const filteredPapers = papers.filter(paper => {
      const paperTime = paper.published.getTime();
      return paperTime >= startDateTimestamp && paperTime <= now;
    });

    return filteredPapers;
  } catch (error) {
    console.error('Error fetching from ArXiv:', error);
    throw error;
  }
}

/**
 * Parse ArXiv XML response
 */
function parseArxivXML(xmlText: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  // Simple regex-based parsing (for MVP)
  // For production, use a proper XML parser like fast-xml-parser

  // Extract entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const entries = xmlText.match(entryRegex) || [];

  for (const entry of entries) {
    try {
      // Extract fields with regex
      const idMatch = entry.match(/<id>(.*?)<\/id>/);
      const titleMatch = entry.match(/<title>(.*?)<\/title>/s);
      const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/s);
      const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
      const updatedMatch = entry.match(/<updated>(.*?)<\/updated>/);

      // Extract authors
      const authorMatches = entry.matchAll(/<name>(.*?)<\/name>/g);
      const authors = Array.from(authorMatches).map(m => m[1]);

      // Extract categories
      const categoryMatches = entry.matchAll(/<term[^>]*>([^<]+)<\/term>/g);
      const categories = Array.from(categoryMatches)
        .map(m => m[1])
        .filter(cat => cat.startsWith('cs.') || cat.startsWith('stat.'));

      if (!idMatch || !titleMatch || !summaryMatch || !publishedMatch) {
        console.warn('Skipping entry with missing fields');
        continue;
      }

      // Parse ArXiv ID from URL
      const url = idMatch[1];
      const arxivIdMatch = url.match(/(\d+\.\d+)/);
      if (!arxivIdMatch) continue;

      const arxivId = parseArxivId(arxivIdMatch[1]);

      papers.push({
        id: arxivId,
        title: titleMatch[1].trim().replace(/\s+/g, ' '),
        authors,
        summary: summaryMatch[1].trim().replace(/\s+/g, ' '),
        published: new Date(publishedMatch[1]),
        updated: new Date(updatedMatch?.[1] || publishedMatch[1]),
        categories: Array.from(new Set(categories)),
        arxiv_url: `https://arxiv.org/abs/${arxivId}`,
        pdf_url: `https://arxiv.org/pdf/${arxivId}.pdf`,
        primary_category: categories[0] || 'cs.AI',
      });
    } catch (error) {
      console.error('Error parsing entry:', error);
    }
  }

  return papers;
}

/**
 * Map ArXiv categories to our tags
 */
export function mapCategoriesToTags(categories: string[]): PaperTag[] {
  const tags = new Set<PaperTag>();

  // Keyword-based mapping
  const categoryLower = categories.join(' ').toLowerCase();

  // RL keywords
  if (categoryLower.includes('reinforcement') ||
      categoryLower.includes('policy') ||
      categoryLower.includes('q-learning') ||
      categoryLower.includes('actor-critic') ||
      categoryLower.includes('ppo') ||
      categoryLower.includes('dqn')) {
    tags.add('rl');
  }

  // LLM keywords
  if (categoryLower.includes('language model') ||
      categoryLower.includes('llm') ||
      categoryLower.includes('gpt') ||
      categoryLower.includes('transformer') ||
      categoryLower.includes('attention') ||
      categoryLower.includes('pretraining')) {
    tags.add('llm');
  }

  // Inference keywords
  if (categoryLower.includes('inference') ||
      categoryLower.includes('quantization') ||
      categoryLower.includes('distillation') ||
      categoryLower.includes('optimization') ||
      categoryLower.includes('acceleration')) {
    tags.add('inference');
  }

  // Category-based mapping as fallback
  for (const cat of categories) {
    if (['cs.AI', 'cs.LG', 'stat.ML'].includes(cat)) {
      // Default to LLM if no specific match
      if (tags.size === 0) {
        tags.add('llm');
      }
    }
  }

  return Array.from(tags);
}

/**
 * Fetch papers by tag
 */
export async function fetchPapersByTag(
  tag: PaperTag,
  options: { daysBack?: number; maxResults?: number } = {}
): Promise<ArxivPaper[]> {
  const config = getDomainConfig(tag);
  if (!config) {
    throw new Error(`Unknown tag: ${tag}`);
  }
  return fetchArxivPapers({
    categories: config.arxivCategories,
    maxResults: options.maxResults || config.maxPapersPerDay * 2, // Fetch more for filtering
    daysBack: options.daysBack || 1,
  });
}

/**
 * Fetch a single paper by ArXiv ID
 * Uses ArXiv API's id_list parameter for direct lookup
 */
export async function fetchArxivPaperById(arxivId: string): Promise<ArxivPaper | null> {
  const cleanId = parseArxivId(arxivId);

  // Build search parameters using id_list
  const params = new URLSearchParams({
    id_list: cleanId,
  });

  const url = `${ARXIV_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Paperfuse/1.0 (https://github.com/yourusername/paperfuse)',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`ArXiv API returned ${response.status}`);
    }

    const xmlText = await response.text();
    const papers = parseArxivXML(xmlText);

    // Return the first (and only) paper, or null if not found
    return papers.length > 0 ? papers[0] : null;
  } catch (error) {
    console.error(`Error fetching ArXiv paper ${arxivId}:`, error);
    return null;
  }
}

/**
 * Fetch all papers for all configured tags
 */
export async function fetchAllPapers(daysBack: number = 1): Promise<Map<PaperTag, ArxivPaper[]>> {
  const results = new Map<PaperTag, ArxivPaper[]>();

  for (const tag of getTopicKeys() as PaperTag[]) {
    try {
      const papers = await fetchPapersByTag(tag, { daysBack });
      results.set(tag, papers);
      console.log(`Fetched ${papers.length} papers for tag: ${tag}`);
    } catch (error) {
      console.error(`Error fetching papers for tag ${tag}:`, error);
      results.set(tag, []);
    }
  }

  return results;
}
