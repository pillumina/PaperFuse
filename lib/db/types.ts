// ============================================
// Database Types (matching Supabase schema)
// ============================================

export type PaperTag = 'rl' | 'llm' | 'inference';

export type JobStatus = 'pending' | 'filtering' | 'analyzing' | 'completed' | 'failed';
export type JobType = 'quick_score' | 'deep_analysis';

export interface Paper {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string[];
  summary: string | null; // Original abstract
  ai_summary: string | null; // AI-generated summary
  key_insights: string[] | null;
  engineering_notes: string | null;
  code_links: string[] | null;
  tags: PaperTag[];
  published_date: string; // ISO date string
  arxiv_url: string;
  pdf_url: string;
  filter_score: number | null; // 1-10
  filter_reason: string | null;
  is_deep_analyzed: boolean;
  version: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  // New fields for detailed analysis
  key_formulas: KeyFormula[] | null;
  algorithms: Algorithm[] | null;
  flow_diagram: FlowDiagram | null;
}

export interface KeyFormula {
  latex: string;
  name: string;
  description: string;
}

export interface Algorithm {
  name: string;
  steps: string[];
  complexity?: string;
}

export interface FlowDiagram {
  format: 'mermaid' | 'text';
  content: string;
}

export interface PaperAnalysisJob {
  id: string;
  paper_id: string;
  status: JobStatus;
  job_type: JobType;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface DailySummary {
  id: string;
  summary_date: string; // ISO date string
  tag: PaperTag;
  total_fetched: number;
  papers_passed_filter: number;
  papers_deep_analyzed: number;
  top_paper_ids: string[];
  created_at: string;
}

// ============================================
// API Types
// ============================================

export interface PaperListResponse {
  papers: PaperListItem[];
  total: number;
  has_more: boolean;
}

export interface PaperListItem {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string[];
  authors_short: string; // First author + "et al."
  summary: string | null; // Original abstract
  ai_summary: string | null;
  engineering_notes?: string | null; // Full text for tooltip
  engineering_notes_preview?: string | null; // Preview for display
  filter_reason?: string | null; // Reason for the score
  code_links?: string[] | null; // Code and resources
  tags: PaperTag[];
  published_date: string;
  filter_score: number | null;
  is_deep_analyzed: boolean;
}

export interface PaperDetailResponse extends Paper {
  // Full paper details including analysis
}

export interface QuickScoreResult {
  score: number; // 1-10
  reason: string;
}

export interface DeepAnalysisResult {
  ai_summary: string;
  key_insights: string[];
  engineering_notes: string;
  code_links: string[];
}

// ============================================
// ArXiv Types
// ============================================

export interface ArxivPaper {
  id: string; // arxiv_id without version
  title: string;
  authors: string[];
  summary: string;
  published: Date;
  updated: Date;
  categories: string[];
  arxiv_url: string;
  pdf_url: string;
  primary_category: string;
}

export interface ArxivFetchOptions {
  categories: string[];
  maxResults?: number;
  daysBack?: number;
}

// ============================================
// LLM Types
// ============================================

export interface QuickScoreInput {
  title: string;
  summary: string;
  tags: PaperTag[];
}

export interface DeepAnalysisInput {
  title: string;
  summary: string;
  tags: PaperTag[];
  full_text?: string; // Optional full paper text
}

// ============================================
// Domain Config Types
// ============================================

export interface DomainConfig {
  tag: PaperTag;
  arxivCategories: string[];
  maxPapersPerDay: number;
  deepAnalysisCount: number;
  quickScoreThreshold: number; // Min score to proceed to deep analysis
  keywords: string[]; // For additional relevance filtering
}

export const DOMAIN_CONFIGS: Record<PaperTag, DomainConfig> = {
  rl: {
    tag: 'rl',
    arxivCategories: ['cs.AI', 'cs.LG', 'stat.ML'],
    maxPapersPerDay: 10,
    deepAnalysisCount: 3,
    quickScoreThreshold: 7,
    keywords: ['reinforcement', 'reinforcement learning', 'policy gradient', 'q-learning', 'actor-critic', 'ppo', 'dqn', 'rlhf', 'rlaif'],
  },
  llm: {
    tag: 'llm',
    arxivCategories: ['cs.AI', 'cs.CL', 'cs.LG'],
    maxPapersPerDay: 10,
    deepAnalysisCount: 3,
    quickScoreThreshold: 7,
    keywords: ['language model', 'llm', 'gpt', 'transformer', 'attention', 'pretraining', 'finetuning', 'alignment', 'llm inference', 'large language'],
  },
  inference: {
    tag: 'inference',
    arxivCategories: ['cs.AI', 'cs.LG', 'cs.DC'],
    maxPapersPerDay: 8,
    deepAnalysisCount: 2,
    quickScoreThreshold: 8,
    keywords: ['inference', 'quantization', 'distillation', 'speculative', 'kv cache', 'acceleration', 'optimization', 'serving', 'latency', 'throughput'],
  },
};
