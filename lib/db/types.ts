// ============================================
// Database Types (matching Supabase schema)
// ============================================

// PaperTag is now dynamic - any string is valid
// Use getTopicKeys() from lib/topics.ts to get valid topics
export type PaperTag = string;
export type AnalysisDepth = 'none' | 'basic' | 'standard' | 'full';  // Analysis depth level

// Re-export domain config types and functions from lib/topics
// Domain configuration is now managed dynamically through TOPICS_CONFIG
export type { DomainConfig } from '../topics';
export { getDomainConfig, getAllDomainConfigs } from '../topics';

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
  tags: string[]; // PaperTag[] when analyzed, ArXiv categories when not
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
  // Analysis depth tracking
  analysis_type: AnalysisDepth | null; // Type of analysis performed
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
  tags: string[]; // PaperTag[] when analyzed, ArXiv categories when not
  published_date: string;
  filter_score: number | null;
  is_deep_analyzed: boolean;
  analysis_type: AnalysisDepth | null; // Type of analysis performed
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
// Domain configuration is now managed dynamically through TOPICS_CONFIG
// Use getDomainConfig(tag) and getAllDomainConfigs() from lib/topics.ts