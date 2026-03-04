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
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/api";
import { DownloadIcon } from "@/icons";

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

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bank Balance</p>
                <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                  ${data.totalBankBalance.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Student Receivables</p>
                <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  ${data.totalReceivables.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue ({data.year})</p>
                <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
                  ${data.revenue.totalPayments.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">{data.revenue.paymentCount} payments</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Withdrawals ({data.year})</p>
                <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                  ${data.withdrawals.total.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">{data.withdrawals.count} withdrawals</p>
              </div>
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
                  {data.banks.map((b) => (
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
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-gray-500">No data available.</div>
        )}
      </div>
    </div>
  );
}
