'use client';

import { useEffect, useState } from 'react';
import { TopicConfig } from '@/lib/topics';

/**
 * Fetch topics from API for client-side use
 * This avoids hydration mismatches by fetching from a server endpoint
 */
export function useTopics(): TopicConfig[] {
  const [topics, setTopics] = useState<TopicConfig[]>([]);

  useEffect(() => {
    fetch('/api/topics')
      .then(res => res.json())
      .then(data => setTopics(data))
      .catch(err => console.error('Failed to fetch topics:', err));
  }, []);

  return topics;
}
