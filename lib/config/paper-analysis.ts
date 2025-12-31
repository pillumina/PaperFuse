/**
 * Paper Analysis Configuration
 * Controls deep analysis behavior including full text download
 */

export type AnalysisType = 'abstract' | 'full_text';  // @deprecated Use AnalysisDepth
export type AnalysisDepth = 'basic' | 'standard' | 'full';

export interface PaperAnalysisConfig {
  /** Default analysis type @deprecated */
  defaultType: AnalysisType;
  /** Analysis depth: basic (abstract only), standard (intro+conclusion), full (all sections) */
  depth: AnalysisDepth;
  /** Minimum score threshold to use full text analysis (when type is 'full_text') @deprecated */
  threshold: number;
  /**
   * Minimum score threshold for detailed output
   * - Standard mode: triggers phase 2 (full detailed analysis)
   * - Full mode: determines whether to output algorithms/formulas/diagrams
   */
  minScoreThreshold: number;
  /** Minimum score to save paper (below this score, papers are skipped) */
  minScoreToSave: number | null;
  /** Cache directory for downloaded paper content */
  cachePath: string;
}

const DEFAULT_CONFIG: PaperAnalysisConfig = {
  defaultType: 'abstract',
  depth: 'basic',
  threshold: 8,
  minScoreThreshold: 7,
  minScoreToSave: null,
  cachePath: './local/cache/papers',
};

/**
 * Get paper analysis configuration from environment variables
 */
export function getPaperAnalysisConfig(): PaperAnalysisConfig {
  const typeFromEnv = process.env.DEEP_ANALYSIS_TYPE;
  const defaultType: AnalysisType =
    typeFromEnv === 'abstract' || typeFromEnv === 'full_text'
      ? typeFromEnv
      : 'abstract';

  const depthFromEnv = process.env.ANALYSIS_DEPTH;
  const depth: AnalysisDepth =
    depthFromEnv === 'basic' || depthFromEnv === 'standard' || depthFromEnv === 'full'
      ? depthFromEnv
      : 'basic';

  const minScoreToSaveStr = process.env.MIN_SCORE_TO_SAVE;
  const minScoreToSave = minScoreToSaveStr ? parseInt(minScoreToSaveStr, 10) : null;

  return {
    defaultType,
    depth,
    threshold: parseInt(process.env.DEEP_ANALYSIS_THRESHOLD || '8', 10),
    minScoreThreshold: parseInt(process.env.MIN_SCORE_THRESHOLD || '7', 10),
    minScoreToSave,
    cachePath: process.env.PAPER_CACHE_PATH || './local/cache/papers',
  };
}

/**
 * Get the analysis type to use
 * @param typeParam - Type from API parameter (highest priority)
 * @returns The analysis type to use
 */
export function getAnalysisType(typeParam: string | null): AnalysisType {
  // Priority: API parameter > environment variable > default
  if (typeParam === 'abstract' || typeParam === 'full_text') {
    return typeParam;
  }

  // Use config default
  const config = getPaperAnalysisConfig();
  return config.defaultType;
}

/**
 * Check if full text analysis should be used for a given score
 * @deprecated Use getAnalysisType() instead
 */
export function shouldUseFullText(score: number): boolean {
  const config = getPaperAnalysisConfig();
  return config.defaultType === 'full_text' && score >= config.threshold;
}

/**
 * Get the analysis depth to use
 * @param depthParam - Depth from API parameter (highest priority)
 * @returns The analysis depth to use
 */
export function getAnalysisDepth(depthParam: string | null): AnalysisDepth {
  // Priority: API parameter > environment variable > default
  if (depthParam === 'basic' || depthParam === 'standard' || depthParam === 'full') {
    return depthParam;
  }

  // Map legacy 'abstract'/'full_text' to new depth
  if (depthParam === 'abstract') return 'basic';
  if (depthParam === 'full_text') return 'full';

  // Use config default
  const config = getPaperAnalysisConfig();
  return config.depth;
}
