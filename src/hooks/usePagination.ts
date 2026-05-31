"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

/**
 * Client-side pagination for table rows. Resets to page 1 when `resetDeps` change (e.g. search/filters).
 */
export function usePagination<T>(items: T[], resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit reset list
  }, resetDeps);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    paginatedItems,
    from,
    to,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}

/** 1-based row index in the full filtered list for the current row on this page */
export function globalRowIndex(page: number, pageSize: number, indexOnPage: number): number {
  return (page - 1) * pageSize + indexOnPage + 1;
}
