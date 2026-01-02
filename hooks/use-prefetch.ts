import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

/**
 * Custom hook for prefetching pages on hover
 * @param delay - Delay in milliseconds before prefetching (default: 150ms)
 */
export function usePrefetch(delay: number = 150) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const prefetch = useCallback((href: string) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to prefetch
    timeoutRef.current = setTimeout(() => {
      router.prefetch(href);
    }, delay);
  }, [router, delay]);

  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return { prefetch, cancelPrefetch };
}
