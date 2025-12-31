import { NextRequest, NextResponse } from 'next/server';
import { createLocalPaperService, isLocalStorageMode } from '@/lib/db/local';
import { fetchArxivPaperById } from '@/lib/arxiv/fetcher';
import { getPaperFullTextByDepth } from '@/lib/paper/full-text-provider';
import { getAnalysisDepth, getPaperAnalysisConfig, type AnalysisDepth } from '@/lib/config/paper-analysis';

/**
 * POST /api/reanalyze
 * Re-analyze papers with specific analysis depth
 *
 * This endpoint allows selective re-analysis with upgrade-only behavior:
 * - depth='basic': Only unanalyzed papers (never downgrade to basic)
 * - depth='standard': Unanalyzed + basic papers (upgrade only)
 * - depth='full': Unanalyzed + basic + standard papers (upgrade only)
 *
 * Core principle: Analysis depth can only upgrade (basic → standard → full), never downgrade
 *
 * Query Parameters:
 * - depth: 'basic' | 'standard' | 'full' (default: from ANALYSIS_DEPTH env var)
 *   - Priority: API parameter > environment variable > 'basic'
 * - maxPapers: number (optional) - limit how many papers to process
 * - maxTokens: number (default: 12000) - override max tokens for LLM response
 * - forceScore: number (optional) - override threshold for full analysis
 *
 * Example:
 * curl -X POST "http://localhost:3000/api/reanalyze?depth=full"
 * curl -X POST "http://localhost:3000/api/reanalyze?depth=standard&maxPapers=10"
 * curl -X POST "http://localhost:3000/api/reanalyze?depth=full&forceScore=8"
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const depthParam = searchParams.get('depth');
    const typeParam = searchParams.get('type');  // For backward compatibility
    const maxPapersParam = searchParams.get('maxPapers');
    const maxPapers = maxPapersParam ? Math.min(parseInt(maxPapersParam), 100) : null;
    const maxTokensParam = searchParams.get('maxTokens');
    const userMaxTokens = maxTokensParam ? parseInt(maxTokensParam) : null;
    const forceScoreParam = searchParams.get('forceScore');
    const forceScore = forceScoreParam ? parseInt(forceScoreParam) : null;

    // Determine analysis depth (API parameter has highest priority, support legacy 'type' param)
    const analysisDepth: AnalysisDepth = getAnalysisDepth(depthParam || typeParam);

    console.log('=== Reanalyze Started ===');
    console.log(`Depth: ${analysisDepth}, Max Papers: ${maxPapers || 'ALL'}, Max Tokens: ${userMaxTokens || 'default'}, Force Score: ${forceScore || 'auto'}`);
    const startTime = Date.now();

    const useLocal = isLocalStorageMode();
    if (!useLocal) {
      return NextResponse.json(
        { error: 'This endpoint only works in local storage mode' },
        { status: 400 }
      );
    }

    const localService = createLocalPaperService();
    const config = getPaperAnalysisConfig();
    const threshold = forceScore || config.minScoreThreshold;

    // Get all papers
    const allPapers = await localService.getPapers({ limit: 1000 });
    let papersToReanalyze = allPapers.papers;

    // Filter based on analysis depth (upgrade-only logic)
    if (analysisDepth === 'basic') {
      // Basic: Only unanalyzed papers (never downgrade to basic)
      papersToReanalyze = papersToReanalyze.filter(p => !p.is_deep_analyzed);
      console.log(`Basic mode: Found ${papersToReanalyze.length} unanalyzed papers`);
    } else if (analysisDepth === 'standard') {
      // Standard: Unanalyzed + basic papers with score >= threshold (upgrade only)
      papersToReanalyze = papersToReanalyze.filter(p => {
        // Include unanalyzed papers
        if (!p.is_deep_analyzed) return true;

        // Include basic (or null for old data) papers with score >= threshold (upgrade)
        const isBasicOrUnanalyzed = p.analysis_type === 'basic' || p.analysis_type === null;
        if (isBasicOrUnanalyzed && (p.filter_score || 0) >= threshold) {
          return true;
        }

        // Skip standard/full papers (never downgrade)
        return false;
      });
      console.log(`Standard mode: Found ${papersToReanalyze.length} papers to upgrade (score >= ${threshold})`);
    } else {
      // Full: Unanalyzed + basic + standard papers (upgrade all)
      papersToReanalyze = papersToReanalyze.filter(p => {
        // Include unanalyzed papers
        if (!p.is_deep_analyzed) return true;

        // Include basic, standard (or null for old data) papers with score >= threshold
        const isUpgradable = p.analysis_type === 'basic' || p.analysis_type === 'standard' ||
                            p.analysis_type === null;
        if (isUpgradable && (p.filter_score || 0) >= threshold) {
          return true;
        }

        // Skip full papers (never downgrade)
        return false;
      });
      console.log(`Full mode: Found ${papersToReanalyze.length} papers to upgrade to full (score >= ${threshold})`);
    }

    if (papersToReanalyze.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No papers to reanalyze for depth=${analysisDepth}`,
        processed: 0,
        skipped: 0,
        upgraded: 0,
        errors: [],
      });
    }

    // Apply maxPapers limit
    const papersToProcess = maxPapers ? papersToReanalyze.slice(0, maxPapers) : papersToReanalyze;
    const totalToProcess = papersToReanalyze.length;
    console.log(`Processing ${papersToProcess.length} of ${totalToProcess} papers`);

    const results = {
      processed: 0,
      skipped: 0,
      upgraded: 0,
      errors: [] as string[],
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    for (const paper of papersToProcess) {
      try {
        console.log(`  Processing ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);
        console.log(`    Current: is_deep_analyzed=${paper.is_deep_analyzed}, analysis_type=${paper.analysis_type}, score=${paper.filter_score || 0}`);

        // Re-fetch from ArXiv to get complete data
        console.log(`    Fetching from ArXiv...`);
        const arxivPaper = await fetchArxivPaperById(paper.arxiv_id);

        if (!arxivPaper) {
          console.log(`    ⚠ Paper not found on ArXiv, using local data`);
        }

        const summary = arxivPaper?.summary || paper.summary || paper.ai_summary || paper.title;
        const categories = arxivPaper?.categories || [];

        console.log(`    Summary length: ${summary.length}, Categories: ${categories.length}`);

        // Get full text based on analysis depth
        const fullTextResult = await getPaperFullTextByDepth(paper.arxiv_id, analysisDepth);

        if (fullTextResult.content) {
          console.log(`    Full text: ${fullTextResult.source} (${fullTextResult.length} chars, depth=${analysisDepth})`);
        } else {
          console.log(`    Using abstract (depth=basic or download failed)`);
          if (fullTextResult.error) {
            console.log(`    Reason: ${fullTextResult.error}`);
          }
        }

        // Call analyze API
        const analysisResponse = await fetch(`${baseUrl}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: paper.title,
            summary: summary,
            categories: categories,
            fullText: fullTextResult.content,
            outputLevel: analysisDepth === 'basic' ? 'phase1' : 'full',
            maxTokens: userMaxTokens || undefined,
            minScoreThreshold: analysisDepth === 'full' ? config.minScoreThreshold : undefined,
          }),
        });

        if (!analysisResponse.ok) {
          const errorText = await analysisResponse.text();
          throw new Error(`Analysis API error: ${analysisResponse.status} - ${errorText}`);
        }

        const analysis = await analysisResponse.json();

        // Update the paper
        const newAnalysisType = analysisDepth;
        const isUpgrade = paper.analysis_type !== newAnalysisType;

        await localService.updatePaper(paper.id, {
          ai_summary: analysis.deepAnalysis?.ai_summary || paper.ai_summary,
          key_insights: analysis.deepAnalysis?.key_insights || null,
          engineering_notes: analysis.deepAnalysis?.engineering_notes || null,
          code_links: analysis.deepAnalysis?.code_links || [],
          key_formulas: analysis.deepAnalysis?.key_formulas || null,
          algorithms: analysis.deepAnalysis?.algorithms || null,
          flow_diagram: analysis.deepAnalysis?.flow_diagram || null,
          filter_score: analysis.score || paper.filter_score,
          filter_reason: analysis.scoreReason || paper.filter_reason,
          is_deep_analyzed: true,
          analysis_type: newAnalysisType,
        });

        results.processed++;
        if (isUpgrade) {
          results.upgraded++;
          console.log(`    ✓ Upgraded: ${paper.analysis_type || 'null'} → ${newAnalysisType}`);
        } else {
          console.log(`    ✓ Completed (${newAnalysisType})`);
        }
      } catch (error) {
        console.error(`  ✗ Error: ${error}`);
        results.errors.push(`${paper.arxiv_id}: ${error}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Reanalyze Complete (${duration}s) ===`);
    console.log(`Processed: ${results.processed}, Upgraded: ${results.upgraded}, Errors: ${results.errors.length}`);

    const skipped = maxPapers ? Math.max(0, totalToProcess - maxPapers) : 0;

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      analysis_depth: analysisDepth,
      total_to_process: totalToProcess,
      ...results,
      skipped,
      message: `Reanalyzed ${results.processed} papers at depth=${analysisDepth} (${results.upgraded} upgraded)`,
    });

  } catch (error) {
    console.error('Error in reanalyze:', error);
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
