import { Button } from '@/components/ui/button';
import { Calendar, ArrowUpDown, RotateCcw } from 'lucide-react';
import { PaperTag } from '@/lib/db/types';

const TAG_LABELS: Record<PaperTag, string> = {
  rl: 'Reinforcement Learning',
  llm: 'Large Language Models',
  inference: 'Inference & Systems',
};

type DateRange = 'all' | 'today' | '7days' | '30days' | 'custom';
type SortBy = 'date' | 'score';
type AnalysisFilter = 'all' | 'analyzed' | 'not-analyzed';

interface FiltersBarProps {
  selectedTag: PaperTag | 'all';
  onTagSelect: (tag: PaperTag | 'all') => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  analysisFilter: AnalysisFilter;
  onAnalysisFilterChange: (filter: AnalysisFilter) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  customDateFrom: string;
  customDateTo: string;
  setCustomDateFrom: (date: string) => void;
  setCustomDateTo: (date: string) => void;
}

export function FiltersBar({
  selectedTag,
  onTagSelect,
  dateRange,
  onDateRangeChange,
  sortBy,
  onSortChange,
  analysisFilter,
  onAnalysisFilterChange,
  onClearAll,
  hasActiveFilters,
  customDateFrom,
  customDateTo,
  setCustomDateFrom,
  setCustomDateTo,
}: FiltersBarProps) {
  return (
    <div className="bg-card border rounded-lg p-4 mb-8 space-y-4">
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
              onClick={() => onDateRangeChange(range)}
              className="h-8"
            >
              {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All'}
            </Button>
          ))}
          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => {
                  const newDateFrom = e.target.value;
                  const maxDateTo = new Date(newDateFrom);
                  maxDateTo.setDate(maxDateTo.getDate() + 30);
                  const maxDateToStr = maxDateTo.toISOString().split('T')[0];
                  setCustomDateFrom(newDateFrom);
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
                  const minDateFrom = new Date(newDateTo);
                  minDateFrom.setDate(minDateFrom.getDate() - 30);
                  const minDateFromStr = minDateFrom.toISOString().split('T')[0];
                  setCustomDateTo(newDateTo);
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
                onClick={() => onDateRangeChange('7days')}
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
              onClick={() => onDateRangeChange('custom')}
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
            onClick={() => onTagSelect('all')}
            className="rounded-full h-8"
          >
            All
          </Button>
          {(['rl', 'llm', 'inference'] as PaperTag[]).map((tag) => (
            <Button
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              onClick={() => onTagSelect(tag)}
              className="rounded-full h-8"
            >
              {TAG_LABELS[tag]}
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
              onClick={() => onAnalysisFilterChange(filter)}
              className="h-8"
            >
              {filter === 'all' ? 'All Papers' : filter === 'analyzed' ? 'Analyzed' : 'Not Analyzed'}
            </Button>
          ))}
        </div>
      </div>

      {/* Sort By and Clear All */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortBy)}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
          >
            <option value="date">Latest First</option>
            <option value="score">Highest Score</option>
          </select>
        </div>

        {/* Clear all filters button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="h-8 gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear all filters
          </Button>
        )}
      </div>
    </div>
  );
}
