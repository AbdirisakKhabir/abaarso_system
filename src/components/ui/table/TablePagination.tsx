"use client";

import React from "react";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  total,
  from,
  to,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
  className = "",
}: Props) {
  if (total === 0) return null;

  return (
    <div
      className={`flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 ${className}`}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing <span className="font-medium text-gray-700 dark:text-gray-300">{from}</span>–
        <span className="font-medium text-gray-700 dark:text-gray-300">{to}</span> of{" "}
        <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          Rows
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Prev
          </button>
          <span className="px-2 text-xs text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
