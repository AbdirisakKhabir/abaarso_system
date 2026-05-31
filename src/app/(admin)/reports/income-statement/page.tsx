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
import { DateInput } from "@/components/form/DateInput";
import { DownloadIcon } from "@/icons";
import {
  FinanceReportBar,
  FinanceReportBarHorizontal,
  FinanceReportDonut,
} from "@/components/reports/FinanceReportChart";

const CURRENT_YEAR = new Date().getFullYear();

export default function IncomeStatementReportPage() {
  const [data, setData] = useState<{
    year: number;
    dateFrom: string;
    dateTo: string;
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
  const [presetYear, setPresetYear] = useState(String(CURRENT_YEAR));
  const [dateFrom, setDateFrom] = useState(`${CURRENT_YEAR}-01-01`);
  const [dateTo, setDateTo] = useState(`${CURRENT_YEAR}-12-31`);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await authFetch(`/api/finance/income-statement?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* empty */
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

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
  } = usePagination(expenseCategoryRows, [dateFrom, dateTo, data]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    if (!data) return;
    const lines = [
      ["Income Statement", ""],
      ["Period from", data.dateFrom],
      ["Period to", data.dateTo],
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
    const csv = lines
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Income_Statement_${data.dateFrom}_to_${data.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const catLabels = expenseCategoryRows.map((c) => c.category);
  const catAmounts = expenseCategoryRows.map((c) => c.amount);

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Income Statement" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <DateInput
              id="income-stmt-from"
              value={dateFrom}
              onChange={setDateFrom}
              max={dateTo}
              aria-label="Period start date"
              inputClassName="h-10 w-auto min-w-[140px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="text-gray-500">–</span>
            <DateInput
              id="income-stmt-to"
              value={dateTo}
              onChange={setDateTo}
              min={dateFrom}
              aria-label="Period end date"
              inputClassName="h-10 w-auto min-w-[140px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <select
            value={presetYear}
            onChange={(e) => {
              const y = e.target.value;
              setPresetYear(y);
              setDateFrom(`${y}-01-01`);
              setDateTo(`${y}-12-31`);
            }}
            aria-label="Quick select calendar year"
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={String(y)}>
                Year {y}
              </option>
            ))}
          </select>
          <Link href="/reports/payment">
            <Button variant="outline" size="sm">
              ← All Reports
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-bold text-gray-900">Income Statement</h1>
        <p className="text-sm text-gray-600">
          {data?.dateFrom && data?.dateTo
            ? `Period: ${data.dateFrom} – ${data.dateTo}`
            : "Income statement"}{" "}
          | Generated:{" "}
          {data?.generatedAt
            ? new Date(data.generatedAt).toLocaleString()
            : "—"}
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : data ? (
          <>
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Income statement
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Period {data.dateFrom} to {data.dateTo} · Tuition by payment date
                (paidAt) · Abaarso Tech University ·{" "}
                {new Date(data.generatedAt).toLocaleString()}
              </p>
            </div>

            <div className="no-print grid gap-6 border-b border-gray-200 px-6 py-6 lg:grid-cols-2 dark:border-gray-800">
              <FinanceReportBar
                title="Tuition, total expenses, and net income"
                categories={["Tuition revenue", "Total expenses", "Net income"]}
                data={[
                  data.revenue.tuition,
                  data.expenses.total,
                  data.netIncome,
                ]}
                color="#1e40af"
              />
              <FinanceReportDonut
                title="Expense components"
                labels={["Approved expenses", "Bank withdrawals"]}
                series={[
                  data.expenses.approvedExpenses,
                  data.expenses.withdrawals,
                ]}
              />
            </div>

            {catLabels.length > 0 && (
              <div className="no-print border-b border-gray-200 px-6 py-6 dark:border-gray-800">
                <FinanceReportBarHorizontal
                  title="Approved expenses by category"
                  categories={catLabels}
                  data={catAmounts}
                  height={Math.min(420, 120 + catLabels.length * 28)}
                />
              </div>
            )}

            <div className="overflow-x-auto px-6 py-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Figures
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Section</TableCell>
                    <TableCell isHeader>Item</TableCell>
                    <TableCell isHeader className="text-right">
                      Amount
                    </TableCell>
                    <TableCell isHeader className="text-center">
                      Count
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-gray-50 dark:bg-white/5">
                    <TableCell
                      colSpan={4}
                      className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
                    >
                      Revenue
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-gray-500">Revenue</TableCell>
                    <TableCell>Tuition revenue</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.revenue.tuition.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {data.revenue.paymentCount}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-gray-50 dark:bg-white/5">
                    <TableCell
                      colSpan={4}
                      className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
                    >
                      Expenses
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-gray-500">Expenses</TableCell>
                    <TableCell>Approved expenses</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.expenses.approvedExpenses.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {data.expenses.approvedCount}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-gray-500">Expenses</TableCell>
                    <TableCell>Bank withdrawals</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.expenses.withdrawals.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {data.expenses.withdrawalCount}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-gray-500">Expenses</TableCell>
                    <TableCell className="font-medium">Total expenses</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${data.expenses.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                  </TableRow>
                  <TableRow className="bg-gray-50 dark:bg-white/5">
                    <TableCell
                      colSpan={4}
                      className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
                    >
                      Result
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-gray-500">Result</TableCell>
                    <TableCell className="font-semibold">Net income</TableCell>
                    <TableCell
                      className={`text-right text-base font-semibold tabular-nums ${
                        data.netIncome >= 0
                          ? "text-gray-900 dark:text-white"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      ${data.netIncome.toLocaleString()}
                      {data.netIncome < 0 ? " (deficit)" : ""}
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {data.expenseCategories.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-6 dark:border-gray-800">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                  Expense by category
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Category</TableCell>
                      <TableCell isHeader className="text-right">
                        Amount
                      </TableCell>
                      <TableCell isHeader className="text-center">
                        Count
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenseCategories.map((c) => (
                      <TableRow key={c.category}>
                        <TableCell>{c.category}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          ${c.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {c.count}
                        </TableCell>
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

            <div className="border-t border-gray-200 px-6 py-3 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generated {new Date(data.generatedAt).toLocaleString()} ·
                Abaarso Tech University
              </p>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-gray-500">No data available.</div>
        )}
      </div>
    </div>
  );
}
