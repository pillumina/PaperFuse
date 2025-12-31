/**
 * Full Text Provider
 * Unified module for fetching and providing full paper text
 *
 * This module handles:
 * - Checking if full text should be used (based on depth)
 * - Checking cache for previously downloaded content
 * - Downloading LaTeX source from ArXiv
 * - Parsing and caching the content based on depth
 *
 * All analysis endpoints should use this module to get full text.
 */

import { getPaperAnalysisConfig, type AnalysisType, type AnalysisDepth } from '@/lib/config/paper-analysis';
import { getCachedPaper, setCachedPaper } from '@/lib/cache/paper-cache';
import { fetchLatexSource } from '@/lib/arxiv/latex-fetcher';
import { extractMainSections, extractContentByDepth, truncateToLength } from '@/lib/paper/latex-parser';

export interface FullTextResult {
  /** The full text content (or undefined if not available/enabled) */
  content: string | undefined;
  /** Whether full text was used */
  usedFullText: boolean;
  /** Source of the content */
  source: 'cache' | 'latex' | 'abstract' | 'error';
  /** Length of the content */
  length: number;
  /** Error message if something went wrong */
  error?: string;
}

/**
 * Get full text for a paper
 *
 * This function:
 * 1. Checks if full text analysis should be used (type='full_text' and score >= threshold)
 * 2. Checks cache first
 * 3. Downloads LaTeX if cache miss
 * 4. Returns undefined if full text not available
 *
 * @param arxivId - The ArXiv ID of the paper
 * @param score - The paper's filter score (1-10)
 * @param analysisType - The type of analysis ('abstract' | 'full_text')
 * @returns FullTextResult with content and metadata
 */
export async function getPaperFullText(
  arxivId: string,
  score: number | null,
  analysisType?: AnalysisType
): Promise<FullTextResult> {
  const config = getPaperAnalysisConfig();
  const effectiveScore = score || 0;

  // Determine the analysis type to use
  const typeToUse = analysisType || config.defaultType;

  // Step 1: Check if full text should be used
  if (typeToUse !== 'full_text') {
    return {
      content: undefined,
      usedFullText: false,
      source: 'abstract',
      length: 0,
    };
  }

  if (effectiveScore < config.threshold) {
    return {
      content: undefined,
      usedFullText: false,
      source: 'abstract',
      length: 0,
    };
  }

  // Step 2: Check cache
  try {
    const cached = await getCachedPaper(arxivId);
    if (cached) {
      return {
        content: cached,
        usedFullText: true,
        source: 'cache',
        length: cached.length,
      };
    }
  } catch (error) {
    console.error(`[FullTextProvider] Cache error for ${arxivId}:`, error);
    // Continue to download
  }

  // Step 3: Download LaTeX source
  try {
    console.log(`[FullTextProvider] Downloading LaTeX for ${arxivId}...`);
    const latexContent = await fetchLatexSource(arxivId);

    if (!latexContent) {
      return {
        content: undefined,
        usedFullText: false,
        source: 'error',
        length: 0,
        error: 'LaTeX source not found',
      };
    }

    // Step 4: Extract and truncate
    const extracted = extractMainSections(latexContent);
    const fullText = truncateToLength(extracted, 150000);

    // Step 5: Cache for future use
    await setCachedPaper(arxivId, fullText);

    return {
      content: fullText,
      usedFullText: true,
      source: 'latex',
      length: fullText.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[FullTextProvider] Error for ${arxivId}:`, errorMessage);

    return {
      content: undefined,
      usedFullText: false,
      source: 'error',
      length: 0,
      error: errorMessage,
    };
  }
}

/**
 * Get full text for a paper based on analysis depth
 *
 * This function supports the new depth-based approach:
 * - basic: returns undefined (abstract-only analysis)
 * - standard: downloads and extracts intro + conclusion
 * - full: downloads and extracts all sections
 *
 * @param arxivId - The ArXiv ID of the paper
 * @param depth - The analysis depth ('basic' | 'standard' | 'full')
 * @returns FullTextResult with content and metadata
 */
export async function getPaperFullTextByDepth(
  arxivId: string,
  depth: AnalysisDepth
): Promise<FullTextResult> {
  // basic mode: no LaTeX needed
  if (depth === 'basic') {
    return {
      content: undefined,
      usedFullText: false,
      source: 'abstract',
      length: 0,
    };
  }

  // standard and full modes: download LaTeX
  try {
    console.log(`[FullTextProvider] Getting full text for ${arxivId} (depth=${depth})...`);

    // Check cache first (we cache the full LaTeX regardless of depth)
    const cached = await getCachedPaper(arxivId);
    if (cached) {
      // If we have cached full LaTeX, extract based on requested depth
      const extracted = extractContentByDepth(cached, depth);
      const truncated = truncateToLength(extracted, 150000);
      return {
        content: truncated,
        usedFullText: true,
        source: 'cache',
        length: truncated.length,
      };
    }

    // Download LaTeX source
    console.log(`[FullTextProvider] Downloading LaTeX for ${arxivId}...`);
    const latexContent = await fetchLatexSource(arxivId);

    if (!latexContent) {
      return {
        content: undefined,
        usedFullText: false,
        source: 'error',
        length: 0,
        error: 'LaTeX source not found',
      };
    }

    // Extract content based on depth
    const extracted = extractContentByDepth(latexContent, depth);
    const truncated = truncateToLength(extracted, 150000);

    // Cache the full LaTeX for future use (always cache full LaTeX)
    await setCachedPaper(arxivId, latexContent);

    return {
      content: truncated,
      usedFullText: true,
      source: 'latex',
      length: truncated.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[FullTextProvider] Error for ${arxivId}:`, errorMessage);

    return {
      content: undefined,
      usedFullText: false,
      source: 'error',
      length: 0,
      error: errorMessage,
    };
  }
}

/**
 * Get full text for multiple papers in parallel
 *
 * @param papers - Array of papers with arxiv_id and filter_score
 * @returns Map of arxiv_id to FullTextResult
 */
export async function getPapersFullText(
  papers: Array<{ arxiv_id: string; filter_score: number | null }>
): Promise<Map<string, FullTextResult>> {
  const results = new Map<string, FullTextResult>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 3;
  const chunks = [];

  for (let i = 0; i < papers.length; i += CONCURRENCY) {
    chunks.push(papers.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (paper) => {
        const result = await getPaperFullText(paper.arxiv_id, paper.filter_score);
        return [paper.arxiv_id, result] as [string, FullTextResult];
      })
    );

    for (const [arxivId, result] of chunkResults) {
      results.set(arxivId, result);
    }
  }

  return results;
}
