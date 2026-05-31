"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
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
import {
  FinanceReportBar,
  FinanceReportDonut,
} from "@/components/reports/FinanceReportChart";

const STATUS_COLOR: Record<string, "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

const CURRENT_YEAR = new Date().getFullYear();

export default function ExpenseReportPage() {
  const [data, setData] = useState<{
    expenses: {
      id: number;
      amount: number;
      description: string;
      category: string | null;
      status: string;
      requestedBy: { name: string | null; email: string };
      approvedBy: { name: string | null; email: string } | null;
      approvedAt: string | null;
      bank: { code: string; name: string } | null;
      createdAt: string;
    }[];
    totals: { pending: number; approved: number; rejected: number; total: number };
    year: number;
    generatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (statusFilter) params.set("status", statusFilter);
      const res = await authFetch(`/api/finance/expenses-report?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [year, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const expensesList = data?.expenses ?? [];
  const {
    paginatedItems: paginatedExpenses,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: expensesTotal,
    from,
    to,
  } = usePagination(expensesList, [year, statusFilter]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    if (!data?.expenses.length) return;
    const headers = ["Date", "Description", "Category", "Bank", "Amount", "Status", "Requested By", "Approved By"];
    const rows = data.expenses.map((e) => [
      new Date(e.createdAt).toLocaleDateString(),
      e.description,
      e.category || "",
      e.bank ? `${e.bank.code} - ${e.bank.name}` : "",
      e.amount.toFixed(2),
      e.status,
      e.requestedBy?.name || e.requestedBy?.email || "",
      e.approvedBy?.name || e.approvedBy?.email || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Expense_Report_${data.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Expense Report" />
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
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
        <h1 className="text-xl font-bold text-gray-900">Expense Report</h1>
        <p className="text-sm text-gray-600">Year: {year} | Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : data ? (
          <>
            <div className="overflow-x-auto border-b border-gray-200 px-6 py-5 dark:border-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Totals ({data.year})</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Status</TableCell>
                    <TableCell isHeader className="text-right">Amount</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Pending</TableCell>
                    <TableCell className="text-right tabular-nums">${data.totals.pending.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Approved</TableCell>
                    <TableCell className="text-right tabular-nums">${data.totals.approved.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Rejected</TableCell>
                    <TableCell className="text-right tabular-nums">${data.totals.rejected.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">All requests</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">${data.totals.total.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="no-print grid gap-6 border-b border-gray-200 px-6 py-6 lg:grid-cols-2 dark:border-gray-800">
              <FinanceReportBar
                title="Amount by status"
                categories={["Pending", "Approved", "Rejected"]}
                data={[data.totals.pending, data.totals.approved, data.totals.rejected]}
                color="#1e40af"
              />
              <FinanceReportDonut
                title="Share of total by status"
                labels={["Pending", "Approved", "Rejected"]}
                series={[data.totals.pending, data.totals.approved, data.totals.rejected]}
              />
            </div>

            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Expense lines</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Date</TableCell>
                    <TableCell isHeader>Description</TableCell>
                    <TableCell isHeader>Category</TableCell>
                    <TableCell isHeader>Bank</TableCell>
                    <TableCell isHeader className="text-right">Amount</TableCell>
                    <TableCell isHeader>Status</TableCell>
                    <TableCell isHeader>Requested By</TableCell>
                    <TableCell isHeader>Approved By</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-gray-500">
                        No expenses in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell><span className="max-w-[180px] truncate block" title={e.description}>{e.description}</span></TableCell>
                        <TableCell>{e.category || "—"}</TableCell>
                        <TableCell>{e.bank ? `${e.bank.code}` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                          ${e.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge color={STATUS_COLOR[e.status] || "info"} size="sm">{e.status}</Badge>
                        </TableCell>
                        <TableCell>{e.requestedBy?.name || e.requestedBy?.email || "—"}</TableCell>
                        <TableCell>{e.approvedBy?.name || e.approvedBy?.email || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={page}
                totalPages={totalPages}
                total={expensesTotal}
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
