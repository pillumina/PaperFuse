import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  onPrefetch?: (page: number) => void;
  totalCount: number;
  itemsPerPage: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  onPrefetch,
  totalCount,
  itemsPerPage,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Calculate visible page numbers
  const getVisiblePages = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 4) {
      for (let i = 1; i <= maxVisible; i++) {
        pages.push(i);
      }
    } else if (currentPage >= totalPages - 3) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      for (let i = currentPage - 3; i < currentPage + 4; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="mt-8 space-y-4">
      {/* Pagination controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          onPointerEnter={() => currentPage > 1 && onPrefetch?.(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="gap-1"
          aria-label="Previous page"
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
          {visiblePages.map((pageNum) => (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              onPointerEnter={() => currentPage !== pageNum && onPrefetch?.(pageNum)}
              disabled={loading}
              className="w-10 h-10"
              aria-label={`Go to page ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          onPointerEnter={() => currentPage < totalPages && onPrefetch?.(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className="gap-1"
          aria-label="Next page"
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

      {/* Results count */}
      {!loading && totalCount > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} result{totalCount !== 1 ? 's' : ''}
          {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
        </div>
      )}
    </div>
  );
}
