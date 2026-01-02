import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';
import { createLocalPaperService, isLocalStorageMode } from '@/lib/db/local';
import { PaperTag } from '@/lib/db/types';

/**
 * GET /api/papers
 * Get papers with filtering and pagination
 *
 * Supports both Supabase and local JSON storage
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const tag = searchParams.get('tag') as PaperTag | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : null;
    const deepAnalyzedOnly = searchParams.get('deepAnalyzedOnly') === 'true';
    const analyzedOnly = searchParams.get('analyzedOnly');
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const sortBy = searchParams.get('sortBy') as 'date' | 'score' | null;
    const search = searchParams.get('search') || undefined;

    // Use local storage if no Supabase URL or USE_LOCAL_STORAGE=true
    if (isLocalStorageMode()) {
      const localService = createLocalPaperService();
      const result = await localService.getPapers({
        tag: tag || undefined,
        limit,
        offset,
        minScore: minScore || undefined,
        deepAnalyzedOnly,
        analyzedOnly: analyzedOnly === 'true' ? true : analyzedOnly === 'false' ? false : undefined,
        dateFrom,
        dateTo,
        sortBy: sortBy || undefined,
        search,
      });
      return NextResponse.json(result);
    }

    // Use Supabase
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('papers')
      .select('id, arxiv_id, title, authors, ai_summary, engineering_notes, code_links, tags, published_date, filter_score, filter_reason, is_deep_analyzed, analysis_type', { count: 'exact' });

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      query = query.or(`title.ilike.%${search}%,authors.ilike.%${search}%,ai_summary.ilike.%${search}%`);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (minScore) {
      query = query.gte('filter_score', minScore);
    }

    if (deepAnalyzedOnly) {
      query = query.eq('is_deep_analyzed', true);
    }

    // Analysis filter
    if (analyzedOnly === 'true') {
      query = query.not('analysis_type', 'is', null);
      query = query.neq('analysis_type', 'none');
    } else if (analyzedOnly === 'false') {
      query = query.eq('analysis_type', 'none');
    }

    if (dateFrom) {
      query = query.gte('published_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('published_date', dateTo);
    }

    // Order and paginate
    if (sortBy === 'score') {
      query = query
        .order('filter_score', { ascending: false })
        .order('published_date', { ascending: false });
    } else {
      query = query
        .order('published_date', { ascending: false })
        .order('filter_score', { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error: queryError, count: totalCount } = await query;

    if (queryError) throw queryError;

    const papersList = (data || []).map((p: any) => ({
      id: p.id,
      arxiv_id: p.arxiv_id,
      title: p.title,
      authors: p.authors,
      authors_short: p.authors.length > 1
        ? `${p.authors[0]} et al.`
        : p.authors[0] || 'Unknown',
      summary: null, // Not included in list view
      ai_summary: p.ai_summary,
      engineering_notes: p.engineering_notes, // Full text for tooltip
      engineering_notes_preview: p.engineering_notes ? getFirstLine(p.engineering_notes) : null, // Preview for display
      filter_reason: p.filter_reason, // Scoring reason
      code_links: p.code_links, // Code and resources
      tags: p.tags,
      published_date: p.published_date,
      filter_score: p.filter_score,
      is_deep_analyzed: p.is_deep_analyzed,
      analysis_type: p.analysis_type || null,
    }));

    return NextResponse.json({
      papers: papersList,
      total: totalCount || 0,
      has_more: offset + limit < (totalCount || 0),
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch papers' },
      { status: 500 }
    );
  }
}

function getFirstLine(notes: string): string {
  const lines = notes
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  for (const line of lines) {
    if (line.length > 20 && !line.endsWith(':')) {
      return line.length > 80 ? line.substring(0, 80) + '...' : line;
    }
  }
  return lines[0]?.length > 80 ? lines[0].substring(0, 80) + '...' : lines[0] || '';
}
