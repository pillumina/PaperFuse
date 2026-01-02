import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export function usePagination(totalItems: number, itemsPerPage: number) {
  const searchParams = useSearchParams();
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Go to next page
  const nextPage = useCallback(() => {
    setCurrentPage(p => Math.min(totalPages, p + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalPages]);

  // Go to previous page
  const prevPage = useCallback(() => {
    setCurrentPage(p => Math.max(1, p - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Calculate visible page numbers
  const getVisiblePages = useCallback(() => {
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
  }, [currentPage, totalPages]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    handlePageChange,
    nextPage,
    prevPage,
    getVisiblePages,
    canGoPrev: currentPage > 1,
    canGoNext: currentPage < totalPages,
  };
}
