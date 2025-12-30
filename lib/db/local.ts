/**
 * Local JSON-based storage for development/testing
 * No database required - stores data in local/data.json
 */

import fs from 'fs/promises';
import path from 'path';
import { Paper, PaperTag, DailySummary } from '../db/types';

const DATA_FILE = path.join(process.cwd(), 'local', 'data.json');

interface LocalData {
  papers: Record<string, Paper>;
  dailySummaries: Record<string, DailySummary>;
  lastUpdated: string;
}

/**
 * Initialize local data file
 */
async function ensureDataFile(): Promise<void> {
  const dir = path.dirname(DATA_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory exists
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    // File doesn't exist, create with empty data
    const initialData: LocalData = {
      papers: {},
      dailySummaries: {},
      lastUpdated: new Date().toISOString(),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

/**
 * Read local data
 */
async function readData(): Promise<LocalData> {
  await ensureDataFile();
  const content = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write local data
 */
async function writeData(data: LocalData): Promise<void> {
  await ensureDataFile();
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Generate UUID for local use
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Local Storage Service (mimics Supabase client interface)
 */
export class LocalPaperService {
  /**
   * Get papers with filtering and pagination
   */
  async getPapers(options: {
    tag?: PaperTag;
    limit?: number;
    offset?: number;
    minScore?: number;
    deepAnalyzedOnly?: boolean;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'date' | 'score';
    search?: string;
  } = {}): Promise<{
    papers: Array<{
      id: string;
      arxiv_id: string;
      title: string;
      authors: string[];
      authors_short: string;
      summary: string | null;
      ai_summary: string | null;
      engineering_notes_preview?: string | null;
      filter_reason?: string | null;
      code_links?: string[] | null;
      tags: PaperTag[];
      published_date: string;
      filter_score: number | null;
      is_deep_analyzed: boolean;
    }>;
    total: number;
    has_more: boolean;
  }> {
    const data = await readData();
    let papers = Object.values(data.papers);

    // Apply filters
    if (options.tag) {
      papers = papers.filter(p => p.tags.includes(options.tag!));
    }

    if (options.minScore) {
      papers = papers.filter(p => p.filter_score && p.filter_score >= options.minScore!);
    }

    if (options.deepAnalyzedOnly) {
      papers = papers.filter(p => p.is_deep_analyzed);
    }

    if (options.dateFrom) {
      papers = papers.filter(p => p.published_date >= options.dateFrom!);
    }

    if (options.dateTo) {
      papers = papers.filter(p => p.published_date <= options.dateTo!);
    }

    // Search filter (title, authors, ai_summary)
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      papers = papers.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.authors.some(a => a.toLowerCase().includes(searchLower)) ||
        (p.ai_summary && p.ai_summary.toLowerCase().includes(searchLower))
      );
    }

    // Sort
    const sortBy = options.sortBy || 'date';
    papers.sort((a, b) => {
      if (sortBy === 'score') {
        const scoreCompare = (b.filter_score || 0) - (a.filter_score || 0);
        if (scoreCompare !== 0) return scoreCompare;
        return b.published_date.localeCompare(a.published_date);
      }
      // Default: date then score
      const dateCompare = b.published_date.localeCompare(a.published_date);
      if (dateCompare !== 0) return dateCompare;
      return (b.filter_score || 0) - (a.filter_score || 0);
    });

    const total = papers.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    const paginatedPapers = papers.slice(offset, offset + limit);

    return {
      papers: paginatedPapers.map(p => ({
        id: p.id,
        arxiv_id: p.arxiv_id,
        title: p.title,
        authors: p.authors,
        authors_short: p.authors.length > 1
          ? `${p.authors[0]} et al.`
          : p.authors[0] || 'Unknown',
        summary: p.summary, // Original abstract
        ai_summary: p.ai_summary,
        engineering_notes: p.engineering_notes, // Full text for tooltip
        engineering_notes_preview: p.engineering_notes ? this.getFirstLine(p.engineering_notes) : null, // Preview for display
        filter_reason: p.filter_reason, // Scoring reason
        code_links: p.code_links, // Code and resources
        tags: p.tags,
        published_date: p.published_date,
        filter_score: p.filter_score,
        is_deep_analyzed: p.is_deep_analyzed,
      })),
      total,
      has_more: offset + limit < total,
    };
  }

  /**
   * Extract first meaningful line from engineering notes
   */
  private getFirstLine(notes: string): string {
    // Remove markdown formatting and get first line
    const lines = notes
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Find first meaningful line (skip headers like "Current Implementations:")
    for (const line of lines) {
      if (line.length > 20 && !line.endsWith(':')) {
        return line.length > 80 ? line.substring(0, 80) + '...' : line;
      }
    }
    // Fallback to first non-empty line
    return lines[0]?.length > 80 ? lines[0].substring(0, 80) + '...' : lines[0] || '';
  }

  /**
   * Get a single paper by ID
   */
  async getPaperById(id: string): Promise<Paper | null> {
    const data = await readData();
    return data.papers[id] || null;
  }

  /**
   * Get paper by arXiv ID
   */
  async getPaperByArxivId(arxivId: string): Promise<Paper | null> {
    const data = await readData();
    return Object.values(data.papers).find(p => p.arxiv_id === arxivId) || null;
  }

  /**
   * Check if paper exists
   */
  async paperExists(arxivId: string): Promise<boolean> {
    const paper = await this.getPaperByArxivId(arxivId);
    return paper !== null;
  }

  /**
   * Insert a new paper
   */
  async insertPaper(paper: Omit<Paper, 'id' | 'created_at' | 'updated_at'>): Promise<Paper> {
    const data = await readData();
    const id = generateId();

    const newPaper: Paper = {
      ...paper,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    data.papers[id] = newPaper;
    await writeData(data);

    return newPaper;
  }

  /**
   * Update paper (merges tags if provided)
   */
  async updatePaper(
    id: string,
    updates: Partial<Omit<Paper, 'id' | 'created_at' | 'arxiv_id'>>
  ): Promise<Paper | null> {
    const data = await readData();

    if (!data.papers[id]) {
      return null;
    }

    // Merge tags instead of replacing
    let mergedUpdates = { ...updates };
    if (updates.tags && data.papers[id].tags) {
      const existingTags = new Set(data.papers[id].tags);
      updates.tags.forEach(tag => existingTags.add(tag));
      mergedUpdates.tags = Array.from(existingTags) as PaperTag[];
    }

    data.papers[id] = {
      ...data.papers[id],
      ...mergedUpdates,
      updated_at: new Date().toISOString(),
    };

    await writeData(data);
    return data.papers[id];
  }

  /**
   * Update paper with analysis results
   */
  async updatePaperAnalysis(
    id: string,
    analysis: {
      filter_score?: number;
      filter_reason?: string;
      ai_summary?: string;
      key_insights?: string[];
      engineering_notes?: string;
      code_links?: string[];
      is_deep_analyzed?: boolean;
    }
  ): Promise<Paper> {
    const data = await readData();

    if (!data.papers[id]) {
      throw new Error(`Paper not found: ${id}`);
    }

    data.papers[id] = {
      ...data.papers[id],
      ...analysis,
      updated_at: new Date().toISOString(),
    };

    await writeData(data);
    return data.papers[id];
  }

  /**
   * Get daily summary
   */
  async getDailySummary(date: string, tag: PaperTag): Promise<DailySummary | null> {
    const data = await readData();
    const key = `${date}-${tag}`;
    return data.dailySummaries[key] || null;
  }

  /**
   * Create or update daily summary
   */
  async upsertDailySummary(summary: Omit<DailySummary, 'id' | 'created_at'>): Promise<DailySummary> {
    const data = await readData();
    const key = `${summary.summary_date}-${summary.tag}`;

    const dailySummary: DailySummary = {
      ...summary,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    data.dailySummaries[key] = dailySummary;
    await writeData(data);

    return dailySummary;
  }

  /**
   * Clear all data (useful for testing)
   */
  async clearAll(): Promise<void> {
    const initialData: LocalData = {
      papers: {},
      dailySummaries: {},
      lastUpdated: new Date().toISOString(),
    };
    await writeData(initialData);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalPapers: number;
    deepAnalyzedCount: number;
    byTag: Record<string, number>;
  }> {
    const data = await readData();
    const papers = Object.values(data.papers);

    const byTag: Record<string, number> = {};
    for (const paper of papers) {
      for (const tag of paper.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return {
      totalPapers: papers.length,
      deepAnalyzedCount: papers.filter(p => p.is_deep_analyzed).length,
      byTag,
    };
  }
}

/**
 * Create local paper service
 */
export function createLocalPaperService(): LocalPaperService {
  return new LocalPaperService();
}

/**
 * Check if using local storage mode
 */
export function isLocalStorageMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.USE_LOCAL_STORAGE === 'true';
}
