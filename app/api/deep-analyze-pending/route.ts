import { NextRequest, NextResponse } from 'next/server';
import { createLocalPaperService, isLocalStorageMode } from '@/lib/db/local';
import { fetchArxivPaperById } from '@/lib/arxiv/fetcher';

/**
 * POST /api/deep-analyze-pending
 * Deep analyze papers that haven't been analyzed yet
 *
 * This endpoint:
 * 1. Scans local storage for papers with is_deep_analyzed=false
 * 2. Re-fetches complete data from ArXiv (by arxiv_id)
 * 3. Performs deep analysis with the full paper data
 *
 * Uses POST because this operation modifies server-side data.
 *
 * Query Parameters:
 * - maxPapers: number (optional) - limit how many papers to process (default: process ALL)
 * - maxTokens: number (default: 12000) - override max tokens for LLM response
 *
 * Example:
 * curl -X POST "http://localhost:3000/api/deep-analyze-pending?maxTokens=30000"
 * curl -X POST "http://localhost:3000/api/deep-analyze-pending?maxPapers=20&maxTokens=16000"
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const maxPapersParam = searchParams.get('maxPapers');
    const maxPapers = maxPapersParam ? Math.min(parseInt(maxPapersParam), 100) : null; // No limit by default
    const maxTokensParam = searchParams.get('maxTokens');
    const userMaxTokens = maxTokensParam ? parseInt(maxTokensParam) : null;

    console.log('=== Deep Analyze Pending Started ===');
    console.log(`Max Papers: ${maxPapers || 'ALL'}, Max Tokens: ${userMaxTokens || 'default'}`);
    const startTime = Date.now();

    const useLocal = isLocalStorageMode();
    if (!useLocal) {
      return NextResponse.json(
        { error: 'This endpoint only works in local storage mode' },
        { status: 400 }
      );
    }

    const localService = createLocalPaperService();

    // Get all papers, filter for those not deep analyzed
    const allPapers = await localService.getPapers({ limit: 1000 });
    const pendingPapers = allPapers.papers.filter(p => !p.is_deep_analyzed);

    console.log(`Found ${pendingPapers.length} papers pending deep analysis`);

    if (pendingPapers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No papers pending deep analysis',
        processed: 0,
        skipped: 0,
        errors: [],
      });
    }

    // Apply maxPapers limit only if specified
    const papersToProcess = maxPapers ? pendingPapers.slice(0, maxPapers) : pendingPapers;
    const totalToProcess = pendingPapers.length;
    console.log(`Processing ${papersToProcess.length} of ${totalToProcess} papers${maxPapers ? '' : ' (all pending)'}`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    for (const paper of papersToProcess) {
      try {
        console.log(`  Processing ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);

        // Step 1: Re-fetch from ArXiv to get complete data
        console.log(`    Fetching from ArXiv...`);
        const arxivPaper = await fetchArxivPaperById(paper.arxiv_id);

        if (!arxivPaper) {
          console.log(`    ⚠ Paper not found on ArXiv, using local data`);
        }

        // Prepare summary - use ArXiv data if available, otherwise fallback to local
        const summary = arxivPaper?.summary || paper.summary || paper.ai_summary || paper.title;
        const categories = arxivPaper?.categories || [];

        console.log(`    Summary length: ${summary.length}, Categories: ${categories.length}`);

        const analysisResponse = await fetch(`${baseUrl}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: paper.title,
            summary: summary,
            categories: categories,
            skipDeepAnalysis: false, // We want deep analysis
            maxTokens: userMaxTokens || undefined,
          }),
        });

        if (!analysisResponse.ok) {
          const errorText = await analysisResponse.text();
          throw new Error(`Analysis API error: ${analysisResponse.status} - ${errorText}`);
        }

        const analysis = await analysisResponse.json();

        // Update the paper with deep analysis data
        await localService.updatePaper(paper.id, {
          ai_summary: analysis.deep_analysis?.ai_summary || paper.ai_summary,
          key_insights: analysis.deep_analysis?.key_insights || null,
          engineering_notes: analysis.deep_analysis?.engineering_notes || null,
          code_links: analysis.deep_analysis?.code_links || [],
          key_formulas: analysis.deep_analysis?.key_formulas || null,
          algorithms: analysis.deep_analysis?.algorithms || null,
          flow_diagram: analysis.deep_analysis?.flow_diagram || null,
          filter_score: analysis.score || paper.filter_score,
          filter_reason: analysis.scoreReasoning || paper.filter_reason,
          is_deep_analyzed: true,
        });

        results.processed++;
        console.log(`    ✓ Completed`);
      } catch (error) {
        console.error(`  ✗ Error: ${error}`);
        results.errors.push(`${paper.arxiv_id}: ${error}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Deep Analyze Complete (${duration}s) ===`);
    console.log(`Processed: ${results.processed}, Errors: ${results.errors.length}`);

    const skipped = maxPapers ? Math.max(0, totalToProcess - maxPapers) : 0;

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      total_pending: totalToProcess,
      ...results,
      skipped,
      message: maxPapers
        ? `Deep analyzed ${results.processed} of ${totalToProcess} papers (${skipped} skipped due to limit)`
        : `Deep analyzed all ${results.processed} pending papers`,
    });

  } catch (error) {
    console.error('Error in deep-analyze-pending:', error);
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
