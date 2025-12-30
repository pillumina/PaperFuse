/**
 * Level 2: Quick Scorer
 * Uses configured LLM provider (Claude Haiku or GLM-4-Flash) for fast, cheap evaluation
 *
 * Re-export from unified LLM service for backward compatibility
 */

export {
  quickScorePaper,
  batchQuickScore,
} from '../llm/service';

export type { QuickScoreInput, QuickScoreResult } from '../llm/types';

/**
 * Check if paper meets threshold for deep analysis
 */
export function shouldDeepAnalyze(
  scoreResult: { score: number },
  threshold: number
): boolean {
  return scoreResult.score >= threshold;
}

/**
 * Sort papers by score and return top N
 */
export function getTopPapers<T extends { score: number }>(
  papers: T[],
  count: number
): T[] {
  return papers
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

/**
 * Calculate statistics from scores
 */
export function calculateScoreStats(scores: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
} {
  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    mean: Math.round(mean * 10) / 10,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
