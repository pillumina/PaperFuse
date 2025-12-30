import { NextRequest, NextResponse } from 'next/server';
import { classifyPaper } from '@/lib/llm/service';

/**
 * POST /api/classify
 * Classify a paper into research domains (rl/llm/inference)
 *
 * Request body:
 * {
 *   "title": string,
 *   "summary": string,
 *   "categories": string[]  // ArXiv categories
 * }
 *
 * Response:
 * {
 *   "tags": ("rl" | "llm" | "inference")[],
 *   "confidence": "high" | "medium" | "low",
 *   "reasoning": string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, categories = [] } = body;

    if (!title || !summary) {
      return NextResponse.json(
        { error: 'Missing required fields: title, summary' },
        { status: 400 }
      );
    }

    console.log(`Classifying paper: ${title.substring(0, 50)}...`);

    const result = await classifyPaper({
      title,
      summary,
      categories,
    });

    console.log(`  Result: ${result.tags.join(', ')} (${result.confidence})`);
    console.log(`  Reasoning: ${result.reasoning}`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in classify:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
