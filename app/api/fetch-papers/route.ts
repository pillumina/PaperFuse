import { NextRequest, NextResponse } from 'next/server';
import { fetchArxivPapers } from '@/lib/arxiv/fetcher';
import { filterPapers } from '@/lib/filters/rule-filter';
import { PaperTag } from '@/lib/db/types';
import { createLocalPaperService, isLocalStorageMode } from '@/lib/db/local';
import { getSupabaseServerClient } from '@/lib/db/supabase';

/**
 * Analyze a paper using the unified API endpoint
 */
async function analyzePaperViaAPI(
  title: string,
  summary: string,
  categories: string[],
  skipDeepAnalysis = false,
  maxTokens?: number | null
): Promise<{
  tags: PaperTag[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  score: number;
  scoreReason: string;
  deepAnalysis: {
    ai_summary: string;
    key_insights: string[];
    engineering_notes: string;
    code_links: string[];
  } | null;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      summary,
      categories,
      skipDeepAnalysis,
      maxTokens: maxTokens || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analysis API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * GET /api/test-fetch
 * Test endpoint for fetching and analyzing papers from ArXiv
 *
 * NEW UNIFIED FLOW:
 * 1. Fetch papers from ArXiv categories (from ARXIV_CATEGORIES env var)
 * 2. Filter out obviously irrelevant papers
 * 3. Check which papers are already analyzed
 * 4. Call /api/analyze ONCE per paper (classification + scoring + deep analysis)
 * 5. Store all papers
 *
 * Query Parameters:
 * - maxPapers: number (default: 10, maximum: 30) - max papers to process
 * - daysBack: number (default: 3) - how many days back to fetch from ArXiv
 * - skipDeepAnalysis: boolean (default: false) - skip deep analysis to save cost
 * - clear: boolean (default: false) - clear existing data before fetching
 * - minConfidence: 'high' | 'medium' | 'low' (default: 'medium') - only deep analyze papers at this level or above
 * - forceReanalyze: boolean (default: false) - force re-analyze papers even if already deep analyzed
 * - maxTokens: number (default: 12000) - override default max tokens for LLM response
 *
 * Example:
 * GET /api/test-fetch?maxPapers=10&daysBack=7
 * GET /api/test-fetch?maxPapers=5&forceReanalyze=true  # Re-analyze existing papers
 * GET /api/test-fetch?maxPapers=5&maxTokens=16000  # Use higher token limit
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const maxPapers = Math.min(parseInt(searchParams.get('maxPapers') || '10'), 30);
    const daysBack = parseInt(searchParams.get('daysBack') || '3');
    const skipDeepAnalysis = searchParams.get('skipAnalysis') === 'true';
    const clearFirst = searchParams.get('clear') === 'true';
    const minConfidence = searchParams.get('minConfidence') || 'medium';
    const forceReanalyze = searchParams.get('forceReanalyze') === 'true';
    const maxTokensParam = searchParams.get('maxTokens');
    const userMaxTokens = maxTokensParam ? parseInt(maxTokensParam) : null;

    console.log('=== Test Fetch Started (Unified Analysis Flow) ===');
    console.log(`Max Papers: ${maxPapers}, Days Back: ${daysBack}, Skip Deep Analysis: ${skipDeepAnalysis}, Clear: ${clearFirst}, Min Confidence: ${minConfidence}, Force Reanalyze: ${forceReanalyze}, Max Tokens: ${userMaxTokens || 'default'}`);
    const startTime = Date.now();

    const useLocal = isLocalStorageMode();
    console.log(`Storage mode: ${useLocal ? 'Local JSON' : 'Supabase'}`);

    // Clear existing data if requested
    if (clearFirst && useLocal) {
      const localService = createLocalPaperService();
      await localService.clearAll();
      console.log('Cleared existing local data');
    }

    // Read ArXiv categories from environment variable
    const envCategories = process.env.ARXIV_CATEGORIES || 'cs.AI,cs.LG,cs.CL';
    const allCategories = envCategories.split(',').map(c => c.trim());

    const results = {
      total_fetched: 0,
      passed_filter: 0,
      analyzed: 0,
      deep_analyzed: 0,
      stored: 0,
      skipped_already_analyzed: 0,
      errors: [] as string[],
      by_tag: { rl: 0, llm: 0, inference: 0 },
      by_confidence: { high: 0, medium: 0, low: 0 },
      by_score: { high: 0, medium: 0, low: 0 }, // 7-10, 5-6, 1-4
    };

    // Step 1: Fetch from ArXiv
    console.log(`\n--- Step 1: Fetching from ArXiv ---`);
    console.log(`Categories: ${allCategories.join(', ')}`);
    console.log(`Days Back: ${daysBack}`);
    const rawPapers = await fetchArxivPapers({
      categories: allCategories,
      maxResults: maxPapers * 2,
      daysBack,
    });
    results.total_fetched = rawPapers.length;
    console.log(`Fetched ${rawPapers.length} papers`);

    if (rawPapers.length === 0) {
      return NextResponse.json({
        success: true,
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        ...results,
        message: 'No papers found',
      });
    }

    // Step 2: Rule filter
    console.log(`\n--- Step 2: Rule Filter ---`);
    const { passed, rejected } = filterPapers(rawPapers);
    results.passed_filter = passed.length;
    console.log(`Filter: ${passed.length} passed, ${rejected.length} rejected`);

    const papersToProcess = passed.slice(0, maxPapers);
    console.log(`Will process ${papersToProcess.length} papers`);

    // Step 3: Check existing papers
    console.log(`\n--- Step 3: Checking Existing Papers ---`);
    const papersNeedingAnalysis: typeof rawPapers = [];
    const existingData = new Map<string, any>();

    if (useLocal) {
      const localService = createLocalPaperService();
      for (const paper of papersToProcess) {
        const existing = await localService.getPaperByArxivId(paper.id);

        // Skip only if already deep analyzed AND forceReanalyze is false
        if (existing && existing.is_deep_analyzed && !forceReanalyze) {
          existingData.set(paper.id, existing);
          results.skipped_already_analyzed++;
          console.log(`  Skipping ${paper.id} - already analyzed`);
        } else {
          papersNeedingAnalysis.push(paper);
          if (existing && forceReanalyze) {
            console.log(`  Re-analyzing ${paper.id} (forceReanalyze=true)`);
          }
        }
      }
    } else {
      papersNeedingAnalysis.push(...papersToProcess);
    }

    console.log(`  ${papersNeedingAnalysis.length} need analysis, ${existingData.size} already done`);

    // Step 4: Analyze papers (unified API call per paper)
    console.log(`\n--- Step 4: Unified Analysis ---`);
    const analyses = new Map<string, {
      tags: PaperTag[];
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
      score: number;
      scoreReason: string;
      deepAnalysis: any;
    }>();

    for (const paper of papersNeedingAnalysis) {
      try {
        console.log(`  Analyzing ${paper.id}...`);

        // Determine if this paper should get deep analysis
        const shouldDeepAnalyze = !skipDeepAnalysis;

        const analysis = await analyzePaperViaAPI(
          paper.title,
          paper.summary,
          paper.categories,
          !shouldDeepAnalyze,  // skipDeepAnalysis flag
          userMaxTokens  // user-provided maxTokens or null
        );

        analyses.set(paper.id, analysis);
        results.analyzed++;

        // Track stats
        for (const tag of analysis.tags) {
          results.by_tag[tag as keyof typeof results.by_tag]++;
        }
        results.by_confidence[analysis.confidence as keyof typeof results.by_confidence]++;

        if (analysis.score >= 7) results.by_score.high++;
        else if (analysis.score >= 5) results.by_score.medium++;
        else results.by_score.low++;

        if (analysis.deepAnalysis) {
          results.deep_analyzed++;
        }

        console.log(`    Result: tags=[${analysis.tags.join(',')}] score=${analysis.score}/10 confidence=${analysis.confidence} deepAnalysis=${!!analysis.deepAnalysis}`);

      } catch (error) {
        console.error(`  Error analyzing ${paper.id}:`, error);
        results.errors.push(`${paper.id}: ${error}`);
      }
    }

    // Step 5: Store all papers
    console.log(`\n--- Step 5: Storing Papers ---`);

    for (const paper of papersNeedingAnalysis) {
      const analysis = analyses.get(paper.id);
      if (!analysis) continue;

      try {
        const paperData = {
          arxiv_id: paper.id,
          title: paper.title,
          authors: paper.authors,
          summary: paper.summary,
          ai_summary: analysis.deepAnalysis?.ai_summary || null,
          key_insights: analysis.deepAnalysis?.key_insights || null,
          engineering_notes: analysis.deepAnalysis?.engineering_notes || null,
          code_links: analysis.deepAnalysis?.code_links || [],
          // New structured fields
          key_formulas: analysis.deepAnalysis?.key_formulas || null,
          algorithms: analysis.deepAnalysis?.algorithms || null,
          flow_diagram: analysis.deepAnalysis?.flow_diagram || null,
          tags: analysis.tags,
          published_date: paper.published.toISOString().split('T')[0],
          arxiv_url: paper.arxiv_url,
          pdf_url: paper.pdf_url,
          filter_score: analysis.score,
          filter_reason: analysis.scoreReason,
          is_deep_analyzed: !!analysis.deepAnalysis,
          version: 1,
        };

        if (useLocal) {
          const localService = createLocalPaperService();
          const existing = await localService.getPaperByArxivId(paper.id);

          if (existing) {
            await localService.updatePaper(existing.id, paperData);
            console.log(`  Updated: ${paper.id} [${analysis.tags.join(',')}] score=${analysis.score}`);
          } else {
            await localService.insertPaper(paperData);
            console.log(`  Inserted: ${paper.id} [${analysis.tags.join(',')}] score=${analysis.score}`);
          }
        } else {
          const supabase = getSupabaseServerClient();
          const { data: existing } = await supabase
            .from('papers')
            .select('id')
            .eq('arxiv_id', paper.id)
            .single();

          if (existing) {
            await supabase.from('papers').update(paperData).eq('id', existing.id);
          } else {
            await supabase.from('papers').insert(paperData);
          }
        }
        results.stored++;
      } catch (error) {
        console.error(`  Error storing ${paper.id}:`, error);
        results.errors.push(`${paper.id}: ${error}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Test Fetch Complete (${duration}s) ===`);
    console.log(`Stats: ${results.analyzed} analyzed, ${results.deep_analyzed} deep analyzed, ${results.stored} stored`);
    console.log(`By tag: rl=${results.by_tag.rl}, llm=${results.by_tag.llm}, inference=${results.by_tag.inference}`);
    console.log(`By score: high(7-10)=${results.by_score.high}, medium(5-6)=${results.by_score.medium}, low(1-4)=${results.by_score.low}`);

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      ...results,
      message: `Fetched ${results.total_fetched}, analyzed ${results.analyzed}, deep analyzed ${results.deep_analyzed}, stored ${results.stored}`,
    });

  } catch (error) {
    console.error('Error in test-fetch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
