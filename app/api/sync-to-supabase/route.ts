import { NextRequest, NextResponse } from 'next/server';
import { createLocalPaperService } from '@/lib/db/local';
import { getSupabaseServerClient } from '@/lib/db/supabase';

/**
 * POST /api/sync-to-supabase
 * Sync papers from local storage to Supabase
 *
 * This endpoint:
 * 1. Reads all papers from local JSON storage
 * 2. Upserts them to Supabase
 * 3. Returns sync statistics
 *
 * Use case: Fetch papers locally (using /api/test-fetch in local mode),
 * then sync to Supabase for production deployment
 *
 * Query Parameters:
 * - clear: boolean (default: false) - clear Supabase data before syncing
 *
 * Example:
 * POST /api/sync-to-supabase
 * POST /api/sync-to-supabase?clear=true  # Clear Supabase first
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clearFirst = searchParams.get('clear') === 'true';

    console.log('=== Sync Local to Supabase Started ===');
    console.log(`Clear Supabase first: ${clearFirst}`);
    const startTime = Date.now();

    const localService = createLocalPaperService();
    const supabase = getSupabaseServerClient();

    // Get all papers from local storage
    const localPapers = await localService.getPapers({ limit: 1000 });
    console.log(`Found ${localPapers.papers.length} papers in local storage`);

    if (localPapers.papers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No papers to sync',
        synced: 0,
        skipped: 0,
        errors: [],
      });
    }

    // Clear Supabase if requested
    if (clearFirst) {
      console.log('Clearing existing papers from Supabase...');
      const { error: deleteError } = await supabase
        .from('papers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (this is a workaround)

      if (deleteError) {
        console.error('Error clearing Supabase:', deleteError);
        return NextResponse.json(
          { error: 'Failed to clear Supabase', details: deleteError },
          { status: 500 }
        );
      }
      console.log('Cleared Supabase');
    }

    // Sync each paper
    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const paper of localPapers.papers) {
      try {
        // Check if paper already exists in Supabase
        const { data: existing } = await supabase
          .from('papers')
          .select('id')
          .eq('arxiv_id', paper.arxiv_id)
          .single();

        const paperData = {
          arxiv_id: paper.arxiv_id,
          title: paper.title,
          authors: paper.authors,
          summary: paper.summary || null,
          ai_summary: paper.ai_summary,
          key_insights: null, // Not in PaperListItem
          engineering_notes: paper.engineering_notes || null,
          code_links: paper.code_links || [],
          key_formulas: null, // Not in PaperListItem
          algorithms: null, // Not in PaperListItem
          flow_diagram: null, // Not in PaperListItem
          tags: paper.tags,
          published_date: paper.published_date,
          arxiv_url: `https://arxiv.org/abs/${paper.arxiv_id}`,
          pdf_url: `https://arxiv.org/pdf/${paper.arxiv_id}.pdf`,
          filter_score: paper.filter_score,
          filter_reason: paper.filter_reason || null,
          is_deep_analyzed: paper.is_deep_analyzed,
          version: 1,
        };

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('papers')
            .update(paperData)
            .eq('id', existing.id);

          if (updateError) throw updateError;
          console.log(`Updated: ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);
          results.synced++;
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('papers')
            .insert(paperData);

          if (insertError) throw insertError;
          console.log(`Inserted: ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);
          results.synced++;
        }
      } catch (error) {
        console.error(`Error syncing paper ${paper.arxiv_id}:`, error);
        results.errors.push(`${paper.arxiv_id}: ${error}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Sync Complete (${duration}s) ===`);
    console.log(`Synced: ${results.synced}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      ...results,
      message: `Synced ${results.synced} papers to Supabase`,
    });

  } catch (error) {
    console.error('Error in sync-to-supabase:', error);
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
