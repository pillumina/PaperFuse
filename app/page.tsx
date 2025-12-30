'use client';

import { useEffect, useState } from 'react';
import { PaperCard } from '@/components/paper-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaperTag, PaperListItem } from '@/lib/db/types';
import { Loader2, Calendar, ArrowUpDown, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

const TAG_LABELS: Record<PaperTag, string> = {
  rl: 'Reinforcement Learning',
  llm: 'Large Language Models',
  inference: 'Inference & Systems',
};

type DateRange = 'all' | '7days' | '30days';
type SortBy = 'date' | 'score';
const PAPERS_PER_PAGE = 9;

export default function Home() {
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<PaperTag | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadPapers();
  }, [selectedTag, dateRange, sortBy, searchQuery, currentPage]);

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
      const toDate = today.toISOString().split('T')[0];
      params.append('dateTo', toDate);

      if (dateRange === '7days') {
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
        params.append('dateFrom', fromDate.toISOString().split('T')[0]);
      } else if (dateRange === '30days') {
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);
        params.append('dateFrom', fromDate.toISOString().split('T')[0]);
      }
    }

    // Sorting
    params.append('sortBy', sortBy);

    // Search query
    if (searchQuery.trim()) {
      params.append('search', searchQuery.trim());
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
    setCurrentPage(1);
  }, [selectedTag, dateRange, sortBy, searchQuery]);

  const totalPages = Math.ceil(totalCount / PAPERS_PER_PAGE);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              PaperFuse
            </h1>
            <p className="text-muted-foreground mt-1">
              Daily AI research papers with engineering insights
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters Bar */}
        <div className="bg-card border rounded-lg p-4 mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search papers by title, author, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
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
            <div className="flex gap-2">
              {(['7days', '30days', 'all'] as DateRange[]).map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                  className="h-8"
                >
                  {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All'}
                </Button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Topics:</span>
            <div className="flex gap-2">
              <Button
                variant={selectedTag === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag('all')}
                className="rounded-full h-8"
              >
                All {tagCounts.all !== undefined && `(${tagCounts.all})`}
              </Button>
              {(['rl', 'llm', 'inference'] as PaperTag[]).map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  onClick={() => setSelectedTag(tag)}
                  className="rounded-full h-8"
                >
                  {TAG_LABELS[tag]} {tagCounts[tag] !== undefined && `(${tagCounts[tag]})`}
                </Button>
              ))}
            </div>
          </div>

          {/* Sort By */}
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
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Make sure your environment variables are configured correctly.
            </p>
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No papers found matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && papers.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
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
                    onClick={() => setCurrentPage(pageNum)}
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
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Results count */}
        {!loading && totalCount > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {((currentPage - 1) * PAPERS_PER_PAGE) + 1}-{Math.min(currentPage * PAPERS_PER_PAGE, totalCount)} of {totalCount} paper{totalCount !== 1 ? 's' : ''}
            {selectedTag !== 'all' && ` in ${TAG_LABELS[selectedTag as PaperTag]}`}
            {dateRange !== 'all' && ` from ${dateRange === '7days' ? 'the last 7 days' : 'the last 30 days'}`}
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
          </div>
        )}
      </div>
    </main>
  );
}
