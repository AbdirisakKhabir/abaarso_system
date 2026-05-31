"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/hooks/usePagination";

/**
 * Page state for server-paginated tables. Resets to page 1 when `resetDeps` change (e.g. search/filters).
 */
export function useServerPagination(resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit reset list
  }, resetDeps);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    if (total > 0 && page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages, total]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    setTotal,
    totalPages,
    from,
    to,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}
