import { NextRequest, NextResponse } from 'next/server';
import { fetchArxivPapers } from '@/lib/arxiv/fetcher';
import { filterPapers } from '@/lib/filters/rule-filter';
import { PaperTag, type AnalysisDepth } from '@/lib/db/types';
import { createLocalPaperService, isLocalStorageMode } from '@/lib/db/local';
import { getSupabaseServerClient } from '@/lib/db/supabase';
import { getPaperFullTextByDepth } from '@/lib/paper/full-text-provider';
import { getAnalysisDepth, getPaperAnalysisConfig } from '@/lib/config/paper-analysis';

/**
 * Analyze a paper using the unified API endpoint
 */
async function analyzePaperViaAPI(
  title: string,
  summary: string,
  categories: string[],
  options: {
    outputLevel?: 'phase1' | 'full';
    maxTokens?: number | null;
    fullText?: string;
    minScoreThreshold?: number;  // For full mode to decide detailed output
  } = {}
): Promise<{
  tags: PaperTag[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  score: number;
  scoreReason: string;
  deepAnalysis: {
    ai_summary: string;
    key_insights: string[] | null;
    engineering_notes: string;
    code_links: string[] | null;
    key_formulas: any[] | null;
    algorithms: any[] | null;
    flow_diagram: any | null;
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
      outputLevel: options.outputLevel || 'full',
      maxTokens: options.maxTokens || undefined,
      fullText: options.fullText,
      minScoreThreshold: options.minScoreThreshold,
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
    const depthParam = searchParams.get('depth');
    const minScoreToSaveParam = searchParams.get('minScoreToSave');

    const config = getPaperAnalysisConfig();
    const analysisDepth: AnalysisDepth = getAnalysisDepth(depthParam);
    const minScoreToSave = minScoreToSaveParam ? parseInt(minScoreToSaveParam) : config.minScoreToSave;

    console.log('=== Test Fetch Started (Depth-based Analysis Flow) ===');
    console.log(`Max Papers: ${maxPapers}, Days Back: ${daysBack}, Depth: ${analysisDepth}, Min Score Threshold: ${config.minScoreThreshold}, Min Score to Save: ${minScoreToSave || 'none'}, Clear: ${clearFirst}, Force Reanalyze: ${forceReanalyze}, Max Tokens: ${userMaxTokens || 'default'}`);
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
      skipped_low_score: 0,
      skipped_duplicate: 0,  // New: papers that were duplicates
      phase2_analyzed: 0,  // Papers that got phase 2 (full detailed analysis)
      errors: [] as string[],
      by_tag: { rl: 0, llm: 0, inference: 0 },
      by_confidence: { high: 0, medium: 0, low: 0 },
      by_score: { high: 0, medium: 0, low: 0 }, // 7-10, 5-6, 1-4
      by_depth: { none: 0, basic: 0, standard: 0, full: 0 },
    };

    // Step 0: Check existing papers (for dedup before ArXiv fetch)
    console.log(`\n--- Step 0: Checking Existing Papers (Pre-ArXiv dedup) ---`);
    const existingArxivIds = new Set<string>();

    if (useLocal) {
      const localService = createLocalPaperService();
      const existingPapers = await localService.getPapers({ limit: 10000 });
      for (const p of existingPapers.papers) {
        existingArxivIds.add(p.arxiv_id);
      }
      console.log(`  Found ${existingArxivIds.size} existing papers in local storage`);
    }

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
    console.log(`Fetched ${rawPapers.length} papers from ArXiv`);

    if (rawPapers.length === 0) {
      return NextResponse.json({
        success: true,
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        ...results,
        message: 'No papers found',
      });
    }

    // Step 2: Rule filter + Remove duplicates
    console.log(`\n--- Step 2: Rule Filter + Dedup ---`);
    const { passed, rejected } = filterPapers(rawPapers);
    results.passed_filter = passed.length;
    console.log(`Filter: ${passed.length} passed, ${rejected.length} rejected`);

    // Remove papers that already exist in storage
    const filteredPapers = passed.filter(p => !existingArxivIds.has(p.id));
    const duplicateCount = passed.length - filteredPapers.length;
    results.skipped_duplicate = duplicateCount;
    if (duplicateCount > 0) {
      console.log(`Removed ${duplicateCount} duplicate papers (already in storage)`);
    }

    // Apply maxPapers limit after dedup
    const papersToProcess = filteredPapers.slice(0, maxPapers);
    console.log(`Will process ${papersToProcess.length} papers (after dedup & limit)`);

    // Step 3: Check which papers need re-analysis
    console.log(`\n--- Step 3: Checking Papers Needing Re-Analysis ---`);
    const papersNeedingAnalysis: typeof rawPapers = [];
    const existingData = new Map<string, any>();

    if (useLocal && papersToProcess.length > 0) {
      const localService = createLocalPaperService();
      for (const paper of papersToProcess) {
        const existing = await localService.getPaperByArxivId(paper.id);

        // Only re-analyze if:
        // 1. forceReanalyze is true, OR
        // 2. Paper exists but is_deep_analyzed is false
        if (existing) {
          if (forceReanalyze) {
            papersNeedingAnalysis.push(paper);
            console.log(`  Re-analyzing ${paper.id} (forceReanalyze=true)`);
          } else if (!existing.is_deep_analyzed) {
            papersNeedingAnalysis.push(paper);
            console.log(`  Analyzing ${paper.id} (was not deep analyzed)`);
          } else {
            existingData.set(paper.id, existing);
            results.skipped_already_analyzed++;
            console.log(`  Skipping ${paper.id} - already deep analyzed`);
          }
        } else {
          // This shouldn't happen after dedup, but just in case
          papersNeedingAnalysis.push(paper);
          console.log(`  New paper ${paper.id} (not in local storage yet)`);
        }
      }
    } else {
      // Supabase mode or no papers - process all
      papersNeedingAnalysis.push(...papersToProcess);
    }

    console.log(`  ${papersNeedingAnalysis.length} need analysis, ${existingData.size} skip (already analyzed)`);

    // Check if LLM analysis is enabled
    const llmAnalysisEnabled = process.env.ENABLE_LLM_ANALYSIS === 'true';
    console.log(`\n--- LLM Analysis: ${llmAnalysisEnabled ? 'ENABLED' : 'DISABLED'} ---`);

    // Step 4 & 5: Analyze and store papers one by one (incremental save for resilience)
    console.log(`\n--- Step 4 & 5: Analyze & Store Papers (incremental) ---`);
    console.log(`  Papers to process: ${papersNeedingAnalysis.length}`);
    let processedCount = 0;

    for (const paper of papersNeedingAnalysis) {
      processedCount++;
      try {
        console.log(`  [${processedCount}/${papersNeedingAnalysis.length}] Processing ${paper.id}...`);

        // ===== LLM ANALYSIS DISABLED: Store ArXiv data only =====
        if (!llmAnalysisEnabled) {
          console.log(`    LLM analysis disabled, storing ArXiv data only...`);

          const paperData = {
            arxiv_id: paper.id,
            title: paper.title,
            authors: paper.authors,
            summary: paper.summary,
            ai_summary: null,
            key_insights: null,
            engineering_notes: null,
            code_links: [],
            key_formulas: null,
            algorithms: null,
            flow_diagram: null,
            tags: paper.categories,  // Store ArXiv categories as tags
            published_date: paper.published.toISOString().split('T')[0],
            arxiv_url: paper.arxiv_url,
            pdf_url: paper.pdf_url,
            filter_score: null,
            filter_reason: null,
            is_deep_analyzed: false,
            analysis_type: 'none' as AnalysisDepth,
            version: 1,
          };

          if (useLocal) {
            const localService = createLocalPaperService();
            const existing = await localService.getPaperByArxivId(paper.id);

            if (existing) {
              await localService.updatePaper(existing.id, paperData);
              console.log(`    Updated: ${paper.id} (no analysis)`);
            } else {
              await localService.insertPaper(paperData);
              console.log(`    Inserted: ${paper.id} (no analysis)`);
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
          results.analyzed++;  // Count as "processed" even without LLM
          results.by_depth.none++;
          console.log(`    Done: ${paper.id} (${processedCount}/${papersNeedingAnalysis.length} stored)`);
          continue;
        }

        // ===== LLM ANALYSIS ENABLED: Full analysis flow =====
        console.log(`  Analyzing ${paper.id}...`);
        let analysis: any;
        let actualDepth: AnalysisDepth = analysisDepth;
        let fullTextResult;

        // ===== BASIC MODE: abstract only =====
        if (analysisDepth === 'basic') {
          analysis = await analyzePaperViaAPI(
            paper.title,
            paper.summary,
            paper.categories,
            { outputLevel: 'phase1', maxTokens: userMaxTokens }
          );
          actualDepth = 'basic';
          console.log(`    Basic mode: abstract only`);
        }

        // ===== STANDARD MODE: two-phase (full text downloaded once) =====
        else if (analysisDepth === 'standard') {
          // Download full text once (for both phases)
          console.log(`    Standard mode: downloading full text (will be cached for both phases)...`);
          const fullTextDownloaded = await getPaperFullTextByDepth(paper.id, 'full');

          if (fullTextDownloaded.content) {
            console.log(`      Full text downloaded: ${fullTextDownloaded.source} (${fullTextDownloaded.length} chars)`);
          }

          // Phase 1: Extract intro+conclusion from the downloaded text for scoring
          // Note: getPaperFullTextByDepth with 'standard' will extract intro+conclusion
          const phase1Text = await getPaperFullTextByDepth(paper.id, 'standard');

          console.log(`      Phase 1 text: ${phase1Text.content ? phase1Text.content.length : 0} chars (source: ${phase1Text.source})`);
          if (phase1Text.content && phase1Text.content.length > 0) {
            const preview = phase1Text.content.substring(0, 200).replace(/\n/g, ' ');
            console.log(`      Preview: ${preview}...`);
          }

          // For Phase 1 with fullText, use higher default maxTokens (4000) to accommodate content
          // Truncate phase1 text more aggressively to avoid token limit issues
          const phase1MaxTokens = userMaxTokens || 4000;
          const phase1Content = phase1Text.content && phase1Text.content.length > 10000
            ? phase1Text.content.substring(0, 10000) + '\n\n[Content truncated for Phase 1 scoring...]'
            : phase1Text.content;

          console.log(`      Phase 1 analysis: maxTokens=${phase1MaxTokens}, contentLength=${phase1Content?.length || 0}`);
          const phase1Analysis = await analyzePaperViaAPI(
            paper.title,
            paper.summary,
            paper.categories,
            { outputLevel: 'phase1', maxTokens: phase1MaxTokens, fullText: phase1Content }
          );

          console.log(`      Phase 1 result: score=${phase1Analysis.score}/10, tags=[${phase1Analysis.tags.join(',')}], confidence=${phase1Analysis.confidence}`);
          console.log(`      Score reasoning: ${phase1Analysis.scoreReason?.substring(0, 150) || 'N/A'}...`);
          if (phase1Analysis.deepAnalysis?.ai_summary) {
            console.log(`      AI summary: ${phase1Analysis.deepAnalysis.ai_summary.substring(0, 150)}...`);
          }

          // Check min score to save
          if (minScoreToSave && phase1Analysis.score < minScoreToSave) {
            console.log(`    Skip: score ${phase1Analysis.score} < ${minScoreToSave}`);
            results.skipped_low_score++;
            continue;
          }

          // Phase 2: High score papers get full analysis (use already downloaded full text)
          if (phase1Analysis.score >= config.minScoreThreshold) {
            console.log(`    Phase 2: score ${phase1Analysis.score} >= ${config.minScoreThreshold}, using full text for details...`);
            console.log(`      Phase 2: fullText=${fullTextDownloaded.content?.length || 0} chars, maxTokens=${userMaxTokens || 'default(12000)'}`);
            analysis = await analyzePaperViaAPI(
              paper.title,
              paper.summary,
              paper.categories,
              {
                outputLevel: 'full',
                maxTokens: userMaxTokens,
                fullText: fullTextDownloaded.content,
                minScoreThreshold: config.minScoreThreshold
              }
            );
            actualDepth = 'full';
            results.phase2_analyzed++;
            console.log(`      Phase 2 result: score=${analysis.score}/10, tags=[${analysis.tags.join(',')}], hasDetailedFields=${!!(analysis.deepAnalysis?.key_formulas || analysis.deepAnalysis?.algorithms || analysis.deepAnalysis?.flow_diagram)}`);
          } else {
            analysis = phase1Analysis;
            actualDepth = 'standard';
            console.log(`    Phase 1 only: score ${phase1Analysis.score} < threshold (${config.minScoreThreshold}), using phase1 results`);
          }
        }

        // ===== FULL MODE: one-shot full analysis (model decides detailed output based on score) =====
        else {
          console.log(`    Full mode: downloading complete full text...`);
          fullTextResult = await getPaperFullTextByDepth(paper.id, 'full');
          if (fullTextResult.content) {
            console.log(`      Full text: ${fullTextResult.source} (${fullTextResult.length} chars)`);
            const preview = fullTextResult.content.substring(0, 200).replace(/\n/g, ' ');
            console.log(`      Preview: ${preview}...`);
          }

          console.log(`      Full mode: fullText=${fullTextResult.content?.length || 0} chars, maxTokens=${userMaxTokens || 'default(12000)'}, minScoreThreshold=${config.minScoreThreshold}`);
          analysis = await analyzePaperViaAPI(
            paper.title,
            paper.summary,
            paper.categories,
            {
              outputLevel: 'full',
              maxTokens: userMaxTokens,
              fullText: fullTextResult.content,
              minScoreThreshold: config.minScoreThreshold,  // Model uses this to decide detailed output
            }
          );
          actualDepth = 'full';
          console.log(`      Full mode result: score=${analysis.score}/10, tags=[${analysis.tags.join(',')}], hasDetailedFields=${!!(analysis.deepAnalysis?.key_formulas || analysis.deepAnalysis?.algorithms || analysis.deepAnalysis?.flow_diagram)}`);
        }

        // Track stats
        results.analyzed++;
        results.by_depth[actualDepth]++;

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

        console.log(`    Analysis complete: tags=[${analysis.tags.join(',')}] score=${analysis.score}/10 confidence=${analysis.confidence} depth=${actualDepth}`);

        // ===== IMMEDIATE STORAGE: Store right after analysis completes =====
        console.log(`    Storing ${paper.id}...`);
        const paperData = {
          arxiv_id: paper.id,
          title: paper.title,
          authors: paper.authors,
          summary: paper.summary,
          ai_summary: analysis.deepAnalysis?.ai_summary || null,
          key_insights: analysis.deepAnalysis?.key_insights || null,
          engineering_notes: analysis.deepAnalysis?.engineering_notes || null,
          code_links: analysis.deepAnalysis?.code_links || [],
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
          analysis_type: actualDepth,
          version: 1,
        };

        if (useLocal) {
          const localService = createLocalPaperService();
          const existing = await localService.getPaperByArxivId(paper.id);

          if (existing) {
            await localService.updatePaper(existing.id, paperData);
            console.log(`    Updated: ${paper.id} [${analysis.tags.join(',')}] score=${analysis.score}`);
          } else {
            await localService.insertPaper(paperData);
            console.log(`    Inserted: ${paper.id} [${analysis.tags.join(',')}] score=${analysis.score}`);
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
        console.log(`    Done: ${paper.id} (${processedCount}/${papersNeedingAnalysis.length} saved)`);

      } catch (error) {
        console.error(`  Error processing ${paper.id}:`, error);
        results.errors.push(`${paper.id}: ${error}`);
      }
    }

    // Add existing papers to stored count (they were already in the database)
    results.stored += existingData.size;

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Test Fetch Complete (${duration}s) ===`);
    console.log(`Stats: ${results.analyzed} analyzed, ${results.deep_analyzed} deep analyzed, ${results.stored} stored`);
    console.log(`By depth: basic=${results.by_depth.basic}, standard=${results.by_depth.standard}, full=${results.by_depth.full}`);
    console.log(`By tag: rl=${results.by_tag.rl}, llm=${results.by_tag.llm}, inference=${results.by_tag.inference}`);
    console.log(`By score: high(7-10)=${results.by_score.high}, medium(5-6)=${results.by_score.medium}, low(1-4)=${results.by_score.low}`);
    if (results.skipped_low_score > 0) {
      console.log(`Skipped ${results.skipped_low_score} papers due to low score (< ${minScoreToSave})`);
    }
    if (results.phase2_analyzed > 0) {
      console.log(`Phase 2 (full detailed analysis): ${results.phase2_analyzed} papers`);
    }

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      analysis_depth: analysisDepth,
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
