'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PaperCard } from '@/components/paper-card';
import { PaperCardSkeleton } from '@/components/paper-card-skeleton';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileFilterDrawer } from '@/components/mobile-filter-drawer';
import { PaperTag, PaperListItem } from '@/lib/db/types';
import { Loader2, Calendar, ArrowUpDown, Search, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefetch } from '@/hooks/use-prefetch';
import { getTopics, getTopicLabel } from '@/lib/topics';

type DateRange = 'all' | 'today' | '7days' | '30days' | 'custom';
type SortBy = 'date' | 'score';
type AnalysisFilter = 'all' | 'analyzed' | 'not-analyzed';
const PAPERS_PER_PAGE = 9;

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize all filter states from URL parameters on first render
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<PaperTag | 'all'>(
    () => (searchParams.get('tag') as PaperTag | 'all') || 'all'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle custom date range initialization
  const urlDateRange = searchParams.get('dateRange') as DateRange;
  const urlDateFrom = searchParams.get('dateFrom');
  const urlDateTo = searchParams.get('dateTo');
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
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);
  const isInitializedRef = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Prefetch for pagination
  const { prefetch: prefetchPage } = usePrefetch();

  // Build URL for a specific page (for prefetching)
  const buildPageUrl = useCallback((page: number): string => {
    const params = new URLSearchParams();
    if (selectedTag !== 'all') params.set('tag', selectedTag);
    if (dateRange !== '7days') params.set('dateRange', dateRange);
    if (customDateFrom) params.set('dateFrom', customDateFrom);
    if (customDateTo) params.set('dateTo', customDateTo);
    if (sortBy !== 'date') params.set('sortBy', sortBy);
    if (analysisFilter !== 'all') params.set('analysis', analysisFilter);
    if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
    if (page !== 1) params.set('page', String(page));

    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [selectedTag, dateRange, customDateFrom, customDateTo, sortBy, analysisFilter, debouncedSearchQuery, pathname]);

  useEffect(() => {
    loadPapers();
  }, [selectedTag, dateRange, customDateFrom, customDateTo, sortBy, analysisFilter, debouncedSearchQuery, currentPage]);

  // Sync all filters to URL parameters
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add params that differ from defaults
    if (selectedTag !== 'all') params.set('tag', selectedTag);
    if (dateRange !== '7days') params.set('dateRange', dateRange);
    if (customDateFrom) params.set('dateFrom', customDateFrom);
    if (customDateTo) params.set('dateTo', customDateTo);
    if (sortBy !== 'date') params.set('sortBy', sortBy);
    if (analysisFilter !== 'all') params.set('analysis', analysisFilter);
    if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
    if (currentPage !== 1) params.set('page', String(currentPage));

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    router.replace(newUrl);
  }, [selectedTag, dateRange, customDateFrom, customDateTo, sortBy, analysisFilter, debouncedSearchQuery, currentPage, pathname, router]);

  // Restore scroll position when returning from detail page
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('homeScrollPosition');

    // Restore scroll position
    if (savedScrollPosition) {
      console.log('[Home] Restoring scroll position:', savedScrollPosition);
      window.scrollTo(0, parseInt(savedScrollPosition));
      // Clear after use
      sessionStorage.removeItem('homeScrollPosition');
      sessionStorage.removeItem('homePage');
    }
  }, []);

  // Save scroll position and page before navigating to detail page
  const saveScrollPosition = useCallback(() => {
    console.log('[Home] Saving page:', currentPage);
    sessionStorage.setItem('homeScrollPosition', String(window.scrollY));
    sessionStorage.setItem('homePage', String(currentPage));
  }, [currentPage]);

  // Clear search query
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    if (range === 'custom') {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setCustomDateFrom(weekAgo.toISOString().split('T')[0]);
      setCustomDateTo(today.toISOString().split('T')[0]);
    }
  }, []);

  // Handle tag selection
  const handleTagSelect = useCallback((tag: PaperTag | 'all') => {
    setSelectedTag(tag);
  }, []);

  // Handle analysis filter change
  const handleAnalysisFilterChange = useCallback((filter: AnalysisFilter) => {
    setAnalysisFilter(filter);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSelectedTag('all');
    setDateRange('7days');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSortBy('date');
    setAnalysisFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  // Handle filter changes that reset page
  useEffect(() => {
    window.scrollTo(0, 0);
    // Clear saved page when filters change
    sessionStorage.removeItem('homePage');
  }, [selectedTag, dateRange, customDateFrom, customDateTo, sortBy, analysisFilter, searchQuery]);

  function loadPapers() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();

    // Tag filter
    if (selectedTag !== 'all') {
      params.append('tag', selectedTag);
    }

    // Date range
    if (dateRange !== 'all') {
      const today = new Date();
      const toDate = dateRange === 'custom' && customDateTo ? customDateTo : today.toISOString().split('T')[0];
      params.append('dateTo', toDate);

      if (dateRange === 'today') {
        // Today only
        params.append('dateFrom', toDate);
      } else if (dateRange === '7days') {
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
        params.append('dateFrom', fromDate.toISOString().split('T')[0]);
      } else if (dateRange === '30days') {
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);
        params.append('dateFrom', fromDate.toISOString().split('T')[0]);
      } else if (dateRange === 'custom' && customDateFrom) {
        params.append('dateFrom', customDateFrom);
      }
    }

    // Analysis filter
    if (analysisFilter === 'analyzed') {
      params.append('analyzedOnly', 'true');
    } else if (analysisFilter === 'not-analyzed') {
      params.append('analyzedOnly', 'false');
    }

    // Sorting
    params.append('sortBy', sortBy);

    // Search query (use debounced value)
    if (debouncedSearchQuery.trim()) {
      params.append('search', debouncedSearchQuery.trim());
    }

    // Pagination
    params.append('limit', String(PAPERS_PER_PAGE));
    params.append('offset', String((currentPage - 1) * PAPERS_PER_PAGE));

    fetch(`/api/papers?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch papers');
        return res.json();
      })
      .then(data => {
        setPapers(data.papers || []);
        setTotalCount(data.total || 0);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    // Only reset to page 1 if not restoring from URL parameter
    const pageParam = searchParams.get('page');
    if (!pageParam && isInitializedRef.current) {
      setCurrentPage(1);
    }
  }, [selectedTag, dateRange, customDateFrom, customDateTo, sortBy, analysisFilter, searchQuery, searchParams]);

  const totalPages = Math.ceil(totalCount / PAPERS_PER_PAGE);

  // Keyboard shortcuts (must be after totalPages is calculated)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // If Escape is pressed, clear search and blur input
        if (e.key === 'Escape' && searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
        return;
      }

      // '/' to focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Arrow keys for pagination
      if (e.key === 'ArrowLeft' && currentPage > 1 && !loading) {
        e.preventDefault();
        setCurrentPage(p => p - 1);
      }
      if (e.key === 'ArrowRight' && currentPage < totalPages && !loading) {
        e.preventDefault();
        setCurrentPage(p => p + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, currentPage, totalPages, loading]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                PaperFuse
              </h1>
              <p className="text-muted-foreground mt-1">
                Daily AI research papers with engineering insights
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="hidden sm:block text-xs text-muted-foreground">
                <div className="flex flex-col gap-1 text-right">
                  <span><kbd className="px-1.5 py-0.5 rounded bg-muted border">/</kbd> Focus search</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-muted border">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted border">→</kbd> Navigate pages</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-muted border">Esc</kbd> Clear search</span>
                </div>
              </div>
              <div className="flex items-center border-l pl-4">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Filter Button */}
        <div className="mb-4 sm:hidden flex items-center justify-between">
          <MobileFilterDrawer
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            dateRange={dateRange}
            setDateRange={setDateRange}
            sortBy={sortBy}
            setSortBy={setSortBy}
            analysisFilter={analysisFilter}
            setAnalysisFilter={setAnalysisFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            customDateFrom={customDateFrom}
            setCustomDateFrom={setCustomDateFrom}
            customDateTo={customDateTo}
            setCustomDateTo={setCustomDateTo}
            onClearAll={clearAllFilters}
            hasActiveFilters={!!(selectedTag !== 'all' || dateRange !== '7days' || sortBy !== 'date' || analysisFilter !== 'all' || searchQuery)}
          />
        </div>

        {/* Filters Bar - desktop */}
        <div className="bg-card border rounded-lg p-4 mb-8 space-y-4 hidden sm:block">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search papers by title, author, or keywords... (Press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Date:</span>
            <div className="flex gap-2 flex-wrap">
              {(['today', '7days', '30days', 'all'] as DateRange[]).map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDateRangeChange(range)}
                  className="h-8"
                >
                  {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All'}
                </Button>
              ))}
              {/* Custom Date Range - show when selected */}
              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => {
                      const newDateFrom = e.target.value;
                      // Calculate max allowed date (30 days from dateFrom)
                      const maxDateTo = new Date(newDateFrom);
                      maxDateTo.setDate(maxDateTo.getDate() + 30);
                      const maxDateToStr = maxDateTo.toISOString().split('T')[0];

                      setCustomDateFrom(newDateFrom);
                      // Adjust dateTo if it exceeds the 30-day limit
                      if (customDateTo && customDateTo > maxDateToStr) {
                        setCustomDateTo(maxDateToStr);
                      }
                    }}
                    max={customDateTo || new Date().toISOString().split('T')[0]}
                    min={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="px-2 py-1 text-sm border rounded-md bg-background"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => {
                      const newDateTo = e.target.value;
                      // Calculate min allowed date (30 days before dateTo)
                      const minDateFrom = new Date(newDateTo);
                      minDateFrom.setDate(minDateFrom.getDate() - 30);
                      const minDateFromStr = minDateFrom.toISOString().split('T')[0];

                      setCustomDateTo(newDateTo);
                      // Adjust dateFrom if it's more than 30 days before dateTo
                      if (customDateFrom && customDateFrom < minDateFromStr) {
                        setCustomDateFrom(minDateFromStr);
                      }
                    }}
                    min={customDateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-2 py-1 text-sm border rounded-md bg-background"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDateRangeChange('7days')}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {dateRange !== 'custom' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeChange('custom')}
                  className="h-8"
                >
                  Custom
                </Button>
              )}
            </div>
          </div>

          {/* Tag Filters */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Topics:</span>
            <div className="flex gap-2">
              <Button
                variant={selectedTag === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTagSelect('all')}
                className="rounded-full h-8"
              >
                All {tagCounts.all !== undefined && `(${tagCounts.all})`}
              </Button>
              {(['rl', 'llm', 'inference'] as PaperTag[]).map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  onClick={() => handleTagSelect(tag)}
                  className="rounded-full h-8"
                >
                  {getTopicLabel(tag)} {tagCounts[tag] !== undefined && `(${tagCounts[tag]})`}
                </Button>
              ))}
            </div>
          </div>

          {/* Analysis Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Analysis:</span>
            <div className="flex gap-2">
              {(['all', 'analyzed', 'not-analyzed'] as AnalysisFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant={analysisFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleAnalysisFilterChange(filter)}
                  className="h-8"
                >
                  {filter === 'all' ? 'All Papers' : filter === 'analyzed' ? 'Analyzed' : 'Not Analyzed'}
                </Button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
              >
                <option value="date">Latest First</option>
                <option value="score">Highest Score</option>
              </select>
            </div>

            {/* Clear all filters button */}
            {(selectedTag !== 'all' || dateRange !== '7days' || sortBy !== 'date' || analysisFilter !== 'all' || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear all filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PAPERS_PER_PAGE }).map((_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Make sure your environment variables are configured correctly.
            </p>
          </div>
        ) : papers.length === 0 ? (
          <EmptyState
            type={debouncedSearchQuery ? 'no-results' : 'no-papers'}
            filterDescription={debouncedSearchQuery || undefined}
          />
        ) : (
          <motion.div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            <AnimatePresence mode="wait">
              {papers.map((paper, index) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onNavigate={saveScrollPosition}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Pagination */}
        {papers.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              onPointerEnter={() => currentPage > 1 && prefetchPage(buildPageUrl(currentPage - 1))}
              disabled={currentPage === 1 || loading}
              className="gap-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    onPointerEnter={() => currentPage !== pageNum && prefetchPage(buildPageUrl(pageNum))}
                    disabled={loading}
                    className="w-10 h-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              onPointerEnter={() => currentPage < totalPages && prefetchPage(buildPageUrl(currentPage + 1))}
              disabled={currentPage === totalPages || loading}
              className="gap-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results count */}
        {!loading && totalCount > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {((currentPage - 1) * PAPERS_PER_PAGE) + 1}-{Math.min(currentPage * PAPERS_PER_PAGE, totalCount)} of {totalCount} paper{totalCount !== 1 ? 's' : ''}
            {selectedTag !== 'all' && ` in ${getTopicLabel(selectedTag as PaperTag)}`}
            {dateRange !== 'all' && ` from ${dateRange === '7days' ? 'the last 7 days' : 'the last 30 days'}`}
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
          </div>
        )}
      </div>
    </main>
  );
}

function HomeWrapper() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}

export default HomeWrapper;
