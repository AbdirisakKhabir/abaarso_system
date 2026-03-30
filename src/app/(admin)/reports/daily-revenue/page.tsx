"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { DateInput } from "@/components/form/DateInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { DownloadIcon } from "@/icons";

export default function DailyRevenueReportPage() {
  const [data, setData] = useState<{
    dateFrom: string;
    dateTo: string;
    totalRevenue: number;
    totalCount: number;
    dailySummary: { date: string; total: number; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await authFetch(`/api/finance/daily-revenue?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dailySummaryRows = data?.dailySummary ?? [];
  const {
    paginatedItems: paginatedDailySummary,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: dailySummaryTotal,
    from,
    to,
  } = usePagination(dailySummaryRows, [dateFrom, dateTo]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    if (!data?.dailySummary.length) return;
    const headers = ["Date", "Revenue", "Payment Count"];
    const rows = data.dailySummary.map((d) => [d.date, d.total.toFixed(2), d.count]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Daily_Revenue_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Daily Revenue Report" />
        <div className="flex gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <DateInput
              id="daily-rev-from"
              value={dateFrom}
              onChange={setDateFrom}
              aria-label="Date from"
              inputClassName="h-10 w-auto min-w-[140px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="text-gray-500">to</span>
            <DateInput
              id="daily-rev-to"
              value={dateTo}
              onChange={setDateTo}
              aria-label="Date to"
              inputClassName="h-10 w-auto min-w-[140px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <Link href="/reports/payment">
            <Button variant="outline" size="sm">← All Reports</Button>
          </Link>
          <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>Print</Button>
        </div>
      </div>

      <div className="mb-4 print:block hidden">
        <h1 className="text-xl font-bold text-gray-900">Daily Revenue Report</h1>
        <p className="text-sm text-gray-600">{dateFrom} to {dateTo}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : data ? (
          <>
            <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Daily Revenue Summary</h3>
                <div className="rounded-xl bg-brand-50 px-5 py-3 dark:bg-brand-500/10">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue: </span>
                  <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
                    ${data.totalRevenue.toLocaleString()}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">({data.totalCount} payments)</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Date</TableCell>
                    <TableCell isHeader className="text-center">Payments</TableCell>
                    <TableCell isHeader className="text-right">Revenue</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dailySummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-12 text-center text-gray-500">
                        No payments in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDailySummary.map((d) => (
                      <TableRow key={d.date}>
                        <TableCell>{new Date(d.date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</TableCell>
                        <TableCell className="text-center">{d.count}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          ${d.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={page}
                totalPages={totalPages}
                total={dailySummaryTotal}
                from={from}
                to={to}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-gray-500">No data available.</div>
        )}
      </div>
    </div>
  );
}
