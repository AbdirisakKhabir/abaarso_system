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
import { authFetch } from "@/lib/api";
import { DownloadIcon } from "@/icons";

const CURRENT_YEAR = new Date().getFullYear();

export default function IncomeStatementReportPage() {
  const [data, setData] = useState<{
    year: number;
    revenue: { tuition: number; paymentCount: number };
    expenses: {
      approvedExpenses: number;
      approvedCount: number;
      withdrawals: number;
      withdrawalCount: number;
      total: number;
    };
    expenseCategories: { category: string; amount: number; count: number }[];
    netIncome: number;
    generatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/finance/income-statement?year=${year}`);
      if (res.ok) setData(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const expenseCategoryRows = data?.expenseCategories ?? [];
  const {
    paginatedItems: paginatedExpenseCategories,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: expenseCategoriesTotal,
    from,
    to,
  } = usePagination(expenseCategoryRows, [year, data]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    if (!data) return;
    const lines = [
      ["Income Statement", ""],
      ["Year", data.year],
      ["Generated", data.generatedAt],
      ["", ""],
      ["REVENUE", ""],
      ["Tuition Revenue", `$${data.revenue.tuition.toLocaleString()}`],
      ["Payment Count", data.revenue.paymentCount],
      ["", ""],
      ["EXPENSES", ""],
      ["Approved Expenses", `$${data.expenses.approvedExpenses.toLocaleString()}`],
      ["Bank Withdrawals", `$${data.expenses.withdrawals.toLocaleString()}`],
      ["Total Expenses", `$${data.expenses.total.toLocaleString()}`],
      ["", ""],
      ["NET INCOME", `$${data.netIncome.toLocaleString()}`],
    ];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Income_Statement_${data.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Income Statement" />
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
        <h1 className="text-xl font-bold text-gray-900">Income Statement</h1>
        <p className="text-sm text-gray-600">Year: {year} | Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/5 dark:shadow-none">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : data ? (
          <div className="overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 bg-gradient-to-r from-brand-500/10 to-brand-600/5 px-8 py-6 dark:border-gray-800 dark:from-brand-500/20 dark:to-brand-600/10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Income Statement
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Abaarso Tech University · Fiscal Year {data.year}
              </p>
            </div>

            {/* Revenue Section */}
            <div className="border-b border-gray-200 px-8 py-6 dark:border-gray-800">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white">
                <span className="flex h-8 w-1 rounded-full bg-green-500" />
                Revenue
              </h3>
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 dark:border-green-900/50 dark:bg-green-900/10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tuition Revenue</p>
                    <p className="mt-1 text-3xl font-bold text-green-600 dark:text-green-400">
                      ${data.revenue.tuition.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{data.revenue.paymentCount} payments received</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="border-b border-gray-200 px-8 py-6 dark:border-gray-800">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white">
                <span className="flex h-8 w-1 rounded-full bg-red-500" />
                Expenses
              </h3>
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved Expenses</p>
                      <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                        ${data.expenses.approvedExpenses.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{data.expenses.approvedCount} expenses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Bank Withdrawals</p>
                      <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                        ${data.expenses.withdrawals.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{data.expenses.withdrawalCount} withdrawals</p>
                    </div>
                  </div>
                </div>
                {data.expenseCategories.length > 0 && (
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <p className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-400">Expense by Category</p>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-transparent! hover:bg-transparent!">
                          <TableCell isHeader>Category</TableCell>
                          <TableCell isHeader className="text-right">Amount</TableCell>
                          <TableCell isHeader className="text-center">Count</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedExpenseCategories.map((c) => (
                          <TableRow key={c.category}>
                            <TableCell>{c.category}</TableCell>
                            <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                              ${c.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">{c.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      className="no-print"
                      page={page}
                      totalPages={totalPages}
                      total={expenseCategoriesTotal}
                      from={from}
                      to={to}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </div>
                )}
                <div className="rounded-xl border-2 border-red-200 bg-red-50/50 px-5 py-4 dark:border-red-900/50 dark:bg-red-900/10">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 dark:text-white">Total Expenses</span>
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                      ${data.expenses.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className="px-8 py-8">
              <div className={`rounded-2xl border-2 px-8 py-6 ${
                data.netIncome >= 0
                  ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Income</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                      Revenue − Expenses
                    </p>
                  </div>
                  <p className={`text-4xl font-bold ${
                    data.netIncome >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    ${Math.abs(data.netIncome).toLocaleString()}
                    {data.netIncome < 0 && " (Deficit)"}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-8 py-4 dark:border-gray-800">
              <p className="text-xs text-gray-500">
                Generated on {new Date(data.generatedAt).toLocaleString()} · Abaarso Tech University
              </p>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-gray-500">No data available.</div>
        )}
      </div>
    </div>
  );
}
