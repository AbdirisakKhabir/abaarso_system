"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  FinanceReportBar,
  FinanceReportDonut,
} from "@/components/reports/FinanceReportChart";

const CURRENT_YEAR = new Date().getFullYear();

export default function TreasuryReportPage() {
  const [data, setData] = useState<{
    banks: { id: number; name: string; code: string; balance: number }[];
    totalBankBalance: number;
    totalReceivables: number;
    year: number;
    revenue: { totalPayments: number; paymentCount: number };
    withdrawals: { total: number; count: number };
    generatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/finance/treasury?year=${year}`);
      if (res.ok) setData(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const treasuryBanks = data?.banks ?? [];
  const {
    paginatedItems: paginatedTreasuryBanks,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: treasuryBanksTotal,
    from,
    to,
  } = usePagination(treasuryBanks, [year, data]);

  const bankChart = useMemo(() => {
    if (!data?.banks.length) return { categories: [] as string[], values: [] as number[] };
    const sorted = [...data.banks].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
    return {
      categories: sorted.map((b) => b.code),
      values: sorted.map((b) => b.balance ?? 0),
    };
  }, [data]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    if (!data) return;
    const lines = [
      ["Treasury Summary Report", ""],
      ["Year", data.year],
      ["Generated", data.generatedAt],
      ["", ""],
      ["Total Bank Balance", `$${data.totalBankBalance.toLocaleString()}`],
      ["Total Receivables (Student Balance)", `$${data.totalReceivables.toLocaleString()}`],
      ["Revenue (Payments This Year)", `$${data.revenue.totalPayments.toLocaleString()}`],
      ["Payment Count", data.revenue.paymentCount],
      ["Withdrawals This Year", `$${data.withdrawals.total.toLocaleString()}`],
      ["Withdrawal Count", data.withdrawals.count],
    ];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Treasury_Summary_${data.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Treasury Summary Report" />
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
        <h1 className="text-xl font-bold text-gray-900">Treasury Summary Report</h1>
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
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Summary ({data.year})</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Metric</TableCell>
                    <TableCell isHeader className="text-right">Amount</TableCell>
                    <TableCell isHeader className="text-center">Count</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Total bank balance</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.totalBankBalance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Student receivables</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.totalReceivables.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tuition revenue</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.revenue.totalPayments.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{data.revenue.paymentCount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Withdrawals</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${data.withdrawals.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{data.withdrawals.count}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="no-print grid gap-6 border-b border-gray-200 px-6 py-6 lg:grid-cols-2 dark:border-gray-800">
              <FinanceReportDonut
                title="Revenue vs withdrawals"
                labels={["Tuition revenue", "Withdrawals"]}
                series={[data.revenue.totalPayments, data.withdrawals.total]}
              />
              {bankChart.categories.length > 0 ? (
                <FinanceReportBar
                  title="Balance by bank (code)"
                  categories={bankChart.categories}
                  data={bankChart.values}
                  color="#0f766e"
                />
              ) : (
                <div className="rounded-lg border border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700">
                  No bank rows to chart.
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="mb-4 font-semibold text-gray-800 dark:text-white/90">Bank Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Code</TableCell>
                    <TableCell isHeader>Bank</TableCell>
                    <TableCell isHeader className="text-right">Balance</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTreasuryBanks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono">{b.code}</TableCell>
                      <TableCell>{b.name}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        ${(b.balance ?? 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={page}
                totalPages={totalPages}
                total={treasuryBanksTotal}
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
