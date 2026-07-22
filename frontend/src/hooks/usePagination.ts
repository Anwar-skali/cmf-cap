import { useState, useCallback, useMemo } from 'react';
import { PAGINATION } from '@/lib/constants';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  total?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const [page, setPage] = useState(options.initialPage ?? PAGINATION.DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(options.initialPageSize ?? PAGINATION.DEFAULT_PAGE_SIZE);
  const total = options.total ?? 0;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const hasNext = useMemo(() => page < totalPages, [page, totalPages]);
  const hasPrevious = useMemo(() => page > 1, [page]);

  const nextPage = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const previousPage = useCallback(() => {
    if (hasPrevious) setPage((p) => p - 1);
  }, [hasPrevious]);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(1, p));
  }, []);

  const changePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setPage(PAGINATION.DEFAULT_PAGE);
    setPageSize(PAGINATION.DEFAULT_PAGE_SIZE);
  }, []);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    hasPrevious,
    nextPage,
    previousPage,
    goToPage,
    changePageSize,
    reset,
  };
}
