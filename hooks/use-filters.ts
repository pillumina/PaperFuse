import { useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PaperTag } from '@/lib/db/types';

type DateRange = 'all' | 'today' | '7days' | '30days' | 'custom';
type SortBy = 'date' | 'score';
type AnalysisFilter = 'all' | 'analyzed' | 'not-analyzed';

export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params
  const urlDateRange = searchParams.get('dateRange') as DateRange;
  const urlDateFrom = searchParams.get('dateFrom');
  const urlDateTo = searchParams.get('dateTo');

  const [selectedTag, setSelectedTag] = useState<PaperTag | 'all'>(
    () => (searchParams.get('tag') as PaperTag | 'all') || 'all'
  );
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    if (urlDateFrom || urlDateTo) return 'custom';
    return urlDateRange || '7days';
  });
  const [customDateFrom, setCustomDateFrom] = useState<string>(() => urlDateFrom || '');
  const [customDateTo, setCustomDateTo] = useState<string>(() => urlDateTo || '');
  const [sortBy, setSortBy] = useState<SortBy>(
    () => (searchParams.get('sortBy') as SortBy) || 'date'
  );
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>(
    () => (searchParams.get('analysis') as AnalysisFilter) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('search') || '');

  // Check if any filters are active
  const hasActiveFilters = !!(
    selectedTag !== 'all' ||
    dateRange !== '7days' ||
    sortBy !== 'date' ||
    analysisFilter !== 'all' ||
    searchQuery
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSelectedTag('all');
    setDateRange('7days');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSortBy('date');
    setAnalysisFilter('all');
    setSearchQuery('');
  }, []);

  return {
    selectedTag,
    setSelectedTag,
    dateRange,
    setDateRange,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    sortBy,
    setSortBy,
    analysisFilter,
    setAnalysisFilter,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,
    clearAllFilters,
  };
}
