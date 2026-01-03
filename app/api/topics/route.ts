import { NextResponse } from 'next/server';
import { getTopics } from '@/lib/topics';

/**
 * GET /api/topics
 * Returns the configured topics for client-side use
 */
export async function GET() {
  const topics = getTopics();
  return NextResponse.json(topics);
}
