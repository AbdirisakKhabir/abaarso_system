/** Max rows per request for list APIs (matches tuition-payments). */
export const MAX_LIST_PAGE_SIZE = 100;

export type ParsedPagination = {
  paginate: boolean;
  page: number;
  pageSize: number;
  skip: number;
};

/**
 * When `page` or `pageSize` is present in the query string, list endpoints return
 * `{ items, total, page, pageSize }` instead of a full array.
 */
export function parsePaginationParams(searchParams: URLSearchParams): ParsedPagination {
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const paginate = pageParam != null || pageSizeParam != null;
  const page = Math.max(1, Number(pageParam || 1));
  const pageSize = Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, Number(pageSizeParam || 10)));
  const skip = (page - 1) * pageSize;
  return { paginate, page, pageSize, skip };
}
