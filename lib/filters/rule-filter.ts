import { ArxivPaper, PaperTag } from '../db/types';

/**
 * Level 1: Rule-based Pre-filter
 * Zero-cost filtering to eliminate obvious low-quality papers
 */

/**
 * Title blacklist - words that indicate low-quality or irrelevant papers
 */
const TITLE_BLACKLIST = [
  'workshop',
  'note',
  'preliminary',
  'draft',
  'commentary',
  'opinion',
  'position paper',
  'tutorial',
  'survey', // Can be good, but often not novel
  'review',
  'perspective',
  'thesis', // Bachelor/Master/PhD thesis
];

/**
 * Top venue keywords - papers from these venues are prioritized
 */
const TOP_VENUE_KEYWORDS = [
  'neurips',
  'neural information processing systems',
  'icml',
  'international conference on machine learning',
  'iclr',
  'international conference on learning representations',
  'acl',
  'association for computational linguistics',
  'emnlp',
  'aaai',
  'ijcai',
  'kdd',
  'sigmod',
  'vldb',
  'icde',
];

/**
 * Filter result with reason
 */
export interface FilterResult {
  passed: boolean;
  reason: string;
  score?: number; // Optional initial score based on rules
}

/**
 * Apply rule-based filtering
 */
export function applyRuleFilter(paper: ArxivPaper): FilterResult {
  // Rule 1: Author count check
  // Too few (1) or too many (>50) authors may indicate low quality
  const authorCount = paper.authors.length;
  if (authorCount === 0) {
    return {
      passed: false,
      reason: 'No authors listed',
    };
  }

  // Rule 2: Title blacklist check
  const titleLower = paper.title.toLowerCase();
  for (const blacklistWord of TITLE_BLACKLIST) {
    if (titleLower.includes(blacklistWord)) {
      return {
        passed: false,
        reason: `Title contains blacklist word: ${blacklistWord}`,
      };
    }
  }

  // Rule 3: Title quality check
  // Titles that are too short or too generic
  if (paper.title.length < 15) {
    return {
      passed: false,
      reason: 'Title too short',
    };
  }

  // Rule 4: Summary quality check
  // Very short summaries may indicate work-in-progress
  if (paper.summary.length < 200) {
    return {
      passed: false,
      reason: 'Summary too short',
    };
  }

  // Rule 5: Check for top venue keywords (boost score)
  let baseScore = 5; // Default neutral score
  const combinedText = (paper.title + ' ' + paper.summary).toLowerCase();

  for (const venue of TOP_VENUE_KEYWORDS) {
    if (combinedText.includes(venue)) {
      baseScore = 7; // Boost for top venue
      break;
    }
  }

  // Rule 6: Check for retraction/arXiv disclaimers
  const summaryLower = paper.summary.toLowerCase();
  if (summaryLower.includes('retracted') ||
      summaryLower.includes('withdrawn') ||
      summaryLower.includes('this paper has been removed')) {
    return {
      passed: false,
      reason: 'Paper retracted or withdrawn',
    };
  }

  // Rule 7: Check for obvious non-research content
  if (summaryLower.includes('we are hiring') ||
      summaryLower.includes('job opening') ||
      summaryLower.includes('call for papers')) {
    return {
      passed: false,
      reason: 'Non-research content',
    };
  }

  // Rule 8: Version check
  // Very high version numbers may indicate unstable work
  const versionMatch = paper.id.match(/v(\d+)$/);
  if (versionMatch) {
    const version = parseInt(versionMatch[1]);
    if (version > 5) {
      return {
        passed: false,
        reason: `Too many versions (v${version})`,
      };
    }
  }

  // Passed all rules
  return {
    passed: true,
    reason: 'Passed rule-based filter',
    score: baseScore,
  };
}

/**
 * Filter multiple papers
 */
export function filterPapers(papers: ArxivPaper[]): {
  passed: ArxivPaper[];
  rejected: Array<{ paper: ArxivPaper; reason: string }>;
} {
  const passed: ArxivPaper[] = [];
  const rejected: Array<{ paper: ArxivPaper; reason: string }> = [];

  for (const paper of papers) {
    const result = applyRuleFilter(paper);

    if (result.passed) {
      passed.push(paper);
    } else {
      rejected.push({ paper, reason: result.reason });
    }
  }

  console.log(`Rule filter: ${passed.length} passed, ${rejected.length} rejected`);

  return { passed, rejected };
}

/**
 * Extract paper version from arXiv ID
 */
export function getPaperVersion(arxivId: string): number {
  const match = arxivId.match(/v(\d+)$/);
  return match ? parseInt(match[1]) : 1;
}

/**
 * Check if paper is recent update (not new submission)
 */
export function isRecentUpdate(paper: ArxivPaper, maxDaysOld: number = 7): boolean {
  const daysSincePublished = (Date.now() - paper.published.getTime()) / (1000 * 60 * 60 * 24);
  const daysSinceUpdated = (Date.now() - paper.updated.getTime()) / (1000 * 60 * 60 * 24);

  // Consider it an update if it was published a while ago but recently updated
  return daysSincePublished > maxDaysOld && daysSinceUpdated <= maxDaysOld;
}
