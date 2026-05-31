"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import { DateInput } from "@/components/form/DateInput";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BoltIcon, DownloadIcon } from "@/icons";

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

export default function ActivityLogReportPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("settings.view");

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);
      params.set("limit", "2000");
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (search.trim()) params.set("q", search.trim());
      const res = await authFetch(`/api/activity-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [canView, dateFrom, dateTo, actionFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    from,
    to,
  } = usePagination(rows, [dateFrom, dateTo, actionFilter, search, rows.length]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = [
      "Time",
      "User email",
      "User name",
      "Action",
      "Module",
      "Summary",
      "IP",
    ];
    const lines = rows.map((r) => [
      new Date(r.createdAt).toLocaleString(),
      r.user?.email ?? "",
      r.user?.name ?? "",
      r.action,
      r.module ?? "",
      r.summary.replace(/"/g, '""'),
      r.ipAddress ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...lines.map((cells) =>
        cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Activity_Log_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Activity log report" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">
            You do not have permission to view this report.
          </p>
        </div>
      </div>
    );
  }

  const actionCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Activity log report" />
        <div className="flex flex-wrap gap-2">
          <Link href="/reports/payment">
            <Button variant="outline" size="sm">
              ← Finance reports
            </Button>
          </Link>
          <Link href="/settings/activity-log">
            <Button variant="outline" size="sm">
              Live activity log
            </Button>
          </Link>
          <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/5 no-print">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
          <BoltIcon className="h-4 w-4 text-brand-500" />
          Filters
        </h3>
        <div className="flex flex-wrap gap-4">
          <DateInput
            id="act-log-rpt-from"
            label="From date"
            labelClassName="mb-1 block text-xs text-gray-500"
            value={dateFrom}
            onChange={setDateFrom}
            inputClassName="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <DateInput
            id="act-log-rpt-to"
            label="To date"
            labelClassName="mb-1 block text-xs text-gray-500"
            value={dateTo}
            onChange={setDateTo}
            inputClassName="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <div>
            <label className="mb-1 block text-xs text-gray-500">Action contains</label>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g. auth.login"
              className="h-10 w-full min-w-[160px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Search</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Summary, user, module…"
              className="h-10 w-full min-w-[200px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-bold text-gray-900">System activity log report</h1>
        <p className="text-sm text-gray-600">
          {dateFrom} to {dateTo} · {rows.length} event(s)
        </p>
      </div>

      {!loading && rows.length > 0 && (
        <div className="no-print mb-6 flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/5">
          <div className="rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-800/50">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total events: </span>
            <span className="font-bold text-gray-800 dark:text-white/90">{rows.length}</span>
          </div>
          {Object.entries(actionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([action, n]) => (
              <div
                key={action}
                className="rounded-lg bg-brand-50 px-3 py-2 dark:bg-brand-500/10"
              >
                <code className="text-xs text-brand-700 dark:text-brand-300">{action}</code>
                <span className="ml-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                  {n}
                </span>
              </div>
            ))}
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            No activity in this range. Adjust filters or widen the date range.
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
                    <TableCell isHeader>IP</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.user ? (
                          <>
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              {r.user.name || "—"}
                            </span>
                            <br />
                            <span className="font-mono text-xs text-gray-500">{r.user.email}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                          {r.action}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {r.module || "—"}
                      </TableCell>
                      <TableCell className="max-w-md text-sm text-gray-700 dark:text-gray-300">
                        {r.summary}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{r.ipAddress || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="no-print">
              <TablePagination
                page={page}
                totalPages={totalPages}
                total={total}
                from={from}
                to={to}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
