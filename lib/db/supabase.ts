import { createClient } from '@supabase/supabase-js';

// Singleton client for the browser
let browserClient: ReturnType<typeof createClient> | null = null;

// Get Supabase client for client-side use (uses anon key)
export function getSupabaseClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// Get Supabase client for server-side use (can use service key for writes)
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Database helper functions
import { Paper, PaperTag, PaperListItem, PaperDetailResponse } from './types';

export class PaperService {
  private client: ReturnType<typeof createClient>;

  constructor(client: ReturnType<typeof createClient>) {
    this.client = client;
  }

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
  } = {}): Promise<{ papers: PaperListItem[]; total: number; has_more: boolean }> {
    const {
      tag,
      limit = 20,
      offset = 0,
      minScore,
      deepAnalyzedOnly = false,
      dateFrom,
      dateTo,
    } = options;

    let query = this.client
      .from('papers')
      .select('id, arxiv_id, title, authors, ai_summary, tags, published_date, filter_score, is_deep_analyzed', { count: 'exact' });

    // Apply filters
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (minScore) {
      query = query.gte('filter_score', minScore);
    }

    if (deepAnalyzedOnly) {
      query = query.eq('is_deep_analyzed', true);
    }

    if (dateFrom) {
      query = query.gte('published_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('published_date', dateTo);
    }

    // Order and paginate
    query = query
      .order('published_date', { ascending: false })
      .order('filter_score', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching papers:', error);
      throw error;
    }

    const papers: PaperListItem[] = (data || []).map((p: any) => ({
      id: p.id,
      arxiv_id: p.arxiv_id,
      title: p.title,
      authors: p.authors,
      authors_short: p.authors.length > 1
        ? `${p.authors[0]} et al.`
        : p.authors[0] || 'Unknown',
      summary: p.summary,
      ai_summary: p.ai_summary,
      engineering_notes: p.engineering_notes || null,
      engineering_notes_preview: p.engineering_notes
        ? p.engineering_notes.split('\n')[0].substring(0, 200)
        : null,
      filter_reason: p.filter_reason,
      code_links: p.code_links,
      tags: p.tags,
      published_date: p.published_date,
      filter_score: p.filter_score,
      is_deep_analyzed: p.is_deep_analyzed,
      analysis_type: p.analysis_type || null,
    }));

    return {
      papers,
      total: count || 0,
      has_more: offset + limit < (count || 0),
    };
  }

  /**
   * Get a single paper by ID
   */
  async getPaperById(id: string): Promise<PaperDetailResponse | null> {
    const { data, error } = await this.client
      .from('papers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching paper:', error);
      throw error;
    }

    return data as PaperDetailResponse;
  }

  /**
   * Get paper by arXiv ID
   */
  async getPaperByArxivId(arxivId: string): Promise<Paper | null> {
    const { data, error } = await this.client
      .from('papers')
      .select('*')
      .eq('arxiv_id', arxivId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching paper by arxiv_id:', error);
      throw error;
    }

    return data as Paper;
  }

  /**
   * Check if paper exists (by arXiv ID or similar title)
   */
  async paperExists(arxivId: string, title?: string): Promise<boolean> {
    // Check exact arXiv ID match
    const { data: exactMatch } = await this.client
      .from('papers')
      .select('id')
      .eq('arxiv_id', arxivId)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return true;
    }

    // Check for similar titles (handle version updates)
    if (title) {
      const { data: similarTitle } = await this.client
        .from('papers')
        .select('id')
        .eq('title', title)
        .like('arxiv_id', `${arxivId}%`)
        .limit(1);

      if (similarTitle && similarTitle.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Insert a new paper
   */
  async insertPaper(paper: Omit<Paper, 'id' | 'created_at' | 'updated_at'>): Promise<Paper> {
    const { data, error } = await this.client
      .from('papers')
      .insert(paper as any)
      .select()
      .single();

    if (error) {
      console.error('Error inserting paper:', error);
      throw error;
    }

    return data as Paper;
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
    const { data, error } = await this.client
      .from('papers')
      // @ts-ignore - Supabase type inference issue
      .update(analysis)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating paper:', error);
      throw error;
    }

    return data as Paper;
  }

  /**
   * Get daily summary
   */
  async getDailySummary(date: string, tag: PaperTag) {
    const { data, error } = await this.client
      .from('daily_summaries')
      .select('*')
      .eq('summary_date', date)
      .eq('tag', tag)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching daily summary:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create or update daily summary
   */
  async upsertDailySummary(summary: Omit<any, 'id' | 'created_at'>) {
    const { data, error } = await this.client
      .from('daily_summaries')
      // @ts-ignore - Supabase type inference issue
      .upsert(summary, {
        onConflict: 'summary_date,tag',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting daily summary:', error);
      throw error;
    }

    return data;
  }
}
