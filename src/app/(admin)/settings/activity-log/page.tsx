"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BoltIcon, ListIcon } from "@/icons";

type ActivityRow = {
  id: number;
  createdAt: string;
  action: string;
  module: string | null;
  summary: string;
  ipAddress: string | null;
  userAgent: string | null;
  user: { id: number; email: string; name: string | null } | null;
  metadata: Record<string, unknown> | null;
};

export default function ActivityLogPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(search);
  searchRef.current = search;

  const canView = hasPermission("settings.view");

  const fetchLogs = useCallback(
    async (opts?: { page?: number; pageSize?: number; q?: string }) => {
      const p = opts?.page ?? page;
      const ps = opts?.pageSize ?? pageSize;
      const qRaw = opts?.q !== undefined ? opts.q : searchRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
        });
        const trimmed = qRaw.trim();
        if (trimmed) params.set("q", trimmed);
        const res = await authFetch(`/api/activity-logs?${params}`);
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data.items) ? data.items : []);
          setTotal(typeof data.total === "number" ? data.total : 0);
        } else {
          setItems([]);
          setTotal(0);
        }
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize]
  );

  useEffect(() => {
    if (!canView) return;
    void fetchLogs();
  }, [canView, fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  useEffect(() => {
    if (total > 0 && page > totalPages) setPage(totalPages);
  }, [total, page, totalPages]);

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Activity log" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">
            You do not have permission to view the activity log.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Activity log" />

      <div className="mb-6 min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/3">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <BoltIcon className="h-5 w-5 shrink-0 text-brand-500" />
            System activity log
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Recent sign-ins and other recorded actions. New events appear as the system logs them.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Need a date range, print layout, or CSV?{" "}
            <Link
              href="/reports/activity-log"
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Activity Log Report
            </Link>
          </p>
        </div>
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <div className="relative max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search summary, action, user email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void fetchLogs({ page: 1, q: search });
                }
              }}
              className="h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2 pl-9 pr-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void fetchLogs({ page: 1, q: searchRef.current });
            }}
            className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Search
          </button>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <ListIcon className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {search.trim()
                  ? "No entries match your search."
                  : "No activity recorded yet. Sign in or perform actions to populate the log."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader className="whitespace-nowrap">
                        Time
                      </TableCell>
                      <TableCell isHeader>User</TableCell>
                      <TableCell isHeader>Action</TableCell>
                      <TableCell isHeader>Module</TableCell>
                      <TableCell isHeader>Summary</TableCell>
                      <TableCell isHeader className="whitespace-nowrap">
                        IP
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(row.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.user ? (
                            <>
                              <span className="font-medium text-gray-800 dark:text-white/90">
                                {row.user.name || "—"}
                              </span>
                              <br />
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                {row.user.email}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            {row.action}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {row.module || "—"}
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-gray-700 dark:text-gray-300">
                          <span className="line-clamp-3" title={row.summary}>
                            {row.summary}
                          </span>
                          {row.metadata && Object.keys(row.metadata).length > 0 && (
                            <details className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <summary className="cursor-pointer text-brand-600 dark:text-brand-400">
                                Details
                              </summary>
                              <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-left dark:bg-gray-800/80">
                                {JSON.stringify(row.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {row.ipAddress || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={page}
                totalPages={totalPages}
                total={total}
                from={from}
                to={to}
                pageSize={pageSize}
                onPageChange={(p) => {
                  setPage(p);
                  void fetchLogs({ page: p });
                }}
                onPageSizeChange={(ps) => {
                  setPageSize(ps);
                  setPage(1);
                  void fetchLogs({ page: 1, pageSize: ps });
                }}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
