'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaperTag } from '@/lib/db/types';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { TopicConfig } from '@/lib/topics';

type DateRange = 'all' | 'today' | '7days' | '30days' | 'custom';
type SortBy = 'date' | 'score';
type AnalysisFilter = 'all' | 'analyzed' | 'not-analyzed';

interface MobileFilterDrawerProps {
  selectedTag: PaperTag | 'all';
  setSelectedTag: (tag: PaperTag | 'all') => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
  analysisFilter: AnalysisFilter;
  setAnalysisFilter: (filter: AnalysisFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  customDateFrom: string;
  setCustomDateFrom: (date: string) => void;
  customDateTo: string;
  setCustomDateTo: (date: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  topics: TopicConfig[];
}

export function MobileFilterDrawer({
  selectedTag,
  setSelectedTag,
  dateRange,
  setDateRange,
  sortBy,
  setSortBy,
  analysisFilter,
  setAnalysisFilter,
  searchQuery,
  setSearchQuery,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  onClearAll,
  hasActiveFilters,
  topics,
}: MobileFilterDrawerProps) {

  // Helper functions using topics prop
  const getTopicKeysList = () => topics.map(t => t.key);
  const getTopicLabelByKey = (key: string): string => {
    const topic = topics.find(t => t.key === key);
    return topic?.label || key;
  };
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 sm:hidden">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              •
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Filter papers by topic, date, and analysis status
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="text-sm font-medium mb-2 block">Topics</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTag === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag('all')}
                className="rounded-full"
              >
                All
              </Button>
              {(getTopicKeysList() as PaperTag[]).map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  onClick={() => setSelectedTag(tag)}
                  className="rounded-full"
                >
                  {getTopicLabelByKey(tag)}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-sm font-medium mb-2 block">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              {(['today', '7days', '30days', 'all'] as DateRange[]).map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                  className="w-full"
                >
                  {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All'}
                </Button>
              ))}
            </div>
          </div>

          {/* Analysis */}
          <div>
            <label className="text-sm font-medium mb-2 block">Analysis</label>
            <div className="grid grid-cols-1 gap-2">
              {(['all', 'analyzed', 'not-analyzed'] as AnalysisFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant={analysisFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAnalysisFilter(filter)}
                  className="w-full justify-start"
                >
                  {filter === 'all' ? 'All Papers' : filter === 'analyzed' ? '✓ Analyzed' : '✗ Not Analyzed'}
                </Button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="date">Latest First</option>
              <option value="score">Highest Score</option>
            </select>
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClearAll();
                setOpen(false);
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
