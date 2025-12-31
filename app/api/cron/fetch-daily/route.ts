import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';
import { fetchAllPapers, mapCategoriesToTags } from '@/lib/arxiv/fetcher';
import { filterPapers } from '@/lib/filters/rule-filter';
import { quickScorePaper } from '@/lib/filters/quick-scorer';
import { deepAnalyzePaper } from '@/lib/filters/deep-analyzer';
import { DOMAIN_CONFIGS, PaperTag } from '@/lib/db/types';

/**
 * GET /api/cron/fetch-daily
 * Cron job endpoint for daily paper fetching and analysis
 *
 * This endpoint:
 * 1. Fetches recent papers from ArXiv
 * 2. Applies rule-based filtering
 * 3. Quick scores remaining papers
 * 4. Deep analyzes top papers
 * 5. Stores everything in database
 *
 * Expected to be called by Vercel Cron daily at 2 AM
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request (Vercel header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting daily paper fetch...');
    const startTime = Date.now();

    const supabase = getSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0];

    const results = {
      date: today,
      tags: {} as Record<PaperTag, any>,
      total_processed: 0,
      total_stored: 0,
      errors: [] as string[],
    };

    // Process each tag
    for (const tag of ['rl', 'llm', 'inference'] as PaperTag[]) {
      console.log(`\nProcessing tag: ${tag}`);
      const tagResult = {
        fetched: 0,
        filtered: 0,
        quick_scored: 0,
        deep_analyzed: 0,
        stored: 0,
      };

      try {
        const config = DOMAIN_CONFIGS[tag];

        // Step 1: Fetch from ArXiv
        const papersByTag = await fetchAllPapers(1);
        const papers = papersByTag.get(tag) || [];
        tagResult.fetched = papers.length;
        console.log(`Fetched ${papers.length} papers for ${tag}`);

        // Step 2: Apply rule filter
        const { passed, rejected } = filterPapers(papers);
        tagResult.filtered = passed.length;
        console.log(`Rule filter: ${passed.length} passed, ${rejected.length} rejected`);

        // Step 3: Quick score
        const quickScores = new Map();
        for (const paper of passed) {
          try {
            const tags = mapCategoriesToTags(paper.categories);
            const score = await quickScorePaper({
              title: paper.title,
              summary: paper.summary,
              tags,
            });
            quickScores.set(paper.id, score);
            tagResult.quick_scored++;
          } catch (error) {
            console.error(`Error quick scoring ${paper.id}:`, error);
            quickScores.set(paper.id, { score: 3, reason: 'Error during scoring' });
          }
        }

        // Step 4: Filter by threshold and select top papers for deep analysis
        const highQualityPapers = passed.filter(p => {
          const score = quickScores.get(p.id);
          return score && score.score >= config.quickScoreThreshold;
        });

        const topPapers = highQualityPapers
          .sort((a, b) => {
            const scoreA = quickScores.get(a.id)?.score || 0;
            const scoreB = quickScores.get(b.id)?.score || 0;
            return scoreB - scoreA;
          })
          .slice(0, config.deepAnalysisCount);

        console.log(`Selected ${topPapers.length} papers for deep analysis`);

        // Step 5: Store in database
        for (const paper of passed) {
          try {
            const score = quickScores.get(paper.id);
            if (!score) continue;

            const tags = mapCategoriesToTags(paper.categories);
            const isTopPaper = topPapers.some(p => p.id === paper.id);

            let deepAnalysis = null;
            if (isTopPaper) {
              try {
                deepAnalysis = await deepAnalyzePaper({
                  title: paper.title,
                  summary: paper.summary,
                  tags,
                });
                tagResult.deep_analyzed++;
              } catch (error) {
                console.error(`Error deep analyzing ${paper.id}:`, error);
              }
            }

            // Check if paper already exists
            const { data: existing } = await supabase
              .from('papers')
              .select('id')
              .eq('arxiv_id', paper.id)
              .single();

            if (existing) {
              // Update existing paper
              await supabase
                .from('papers')
                .update({
                  filter_score: score.score,
                  filter_reason: score.reason,
                  ai_summary: deepAnalysis?.ai_summary,
                  key_insights: deepAnalysis?.key_insights,
                  engineering_notes: deepAnalysis?.engineering_notes,
                  is_deep_analyzed: !!deepAnalysis,
                  analysis_type: !!deepAnalysis ? 'abstract' : null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            } else {
              // Insert new paper
              const { error: insertError } = await supabase
                .from('papers')
                .insert({
                  arxiv_id: paper.id,
                  title: paper.title,
                  authors: paper.authors,
                  summary: paper.summary,
                  ai_summary: deepAnalysis?.ai_summary,
                  key_insights: deepAnalysis?.key_insights,
                  engineering_notes: deepAnalysis?.engineering_notes,
                  code_links: [],
                  tags,
                  published_date: paper.published.toISOString().split('T')[0],
                  arxiv_url: paper.arxiv_url,
                  pdf_url: paper.pdf_url,
                  filter_score: score.score,
                  filter_reason: score.reason,
                  is_deep_analyzed: !!deepAnalysis,
                  analysis_type: !!deepAnalysis ? 'abstract' : null,
                  version: 1,
                });

              if (insertError) {
                console.error('Error inserting paper:', insertError);
              } else {
                tagResult.stored++;
              }
            }
          } catch (error) {
            console.error(`Error processing paper ${paper.id}:`, error);
            results.errors.push(`${paper.id}: ${error}`);
          }
        }

        // Update daily summary
        await supabase
          .from('daily_summaries')
          .upsert({
            summary_date: today,
            tag,
            total_fetched: tagResult.fetched,
            papers_passed_filter: tagResult.filtered,
            papers_deep_analyzed: tagResult.deep_analyzed,
            top_paper_ids: [],
          }, {
            onConflict: 'summary_date,tag',
          });

        results.tags[tag] = tagResult;
        results.total_processed += tagResult.fetched;
        results.total_stored += tagResult.stored;

      } catch (error) {
        console.error(`Error processing tag ${tag}:`, error);
        results.errors.push(`${tag}: ${error}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\nCompleted in ${duration}s`);
    console.log(JSON.stringify(results, null, 2));

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      ...results,
    });

  } catch (error) {
    console.error('Error in fetch-daily cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Allow cron to call this endpoint
export const dynamic = 'force-dynamic';
