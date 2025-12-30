import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';
import { createLocalPaperService, isLocalStorageMode } from '@/lib/db/local';

/**
 * GET /api/papers/[id]
 * Get a single paper by ID
 *
 * Supports both Supabase and local JSON storage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Use local storage if no Supabase URL or USE_LOCAL_STORAGE=true
    if (isLocalStorageMode()) {
      const localService = createLocalPaperService();
      const paper = await localService.getPaperById(id);

      if (!paper) {
        return NextResponse.json(
          { error: 'Paper not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(paper);
    }

    // Use Supabase
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Paper not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching paper:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paper' },
      { status: 500 }
    );
  }
}
