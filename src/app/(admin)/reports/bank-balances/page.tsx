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
import { FinanceReportBar } from "@/components/reports/FinanceReportChart";

type Bank = { id: number; name: string; code: string; balance: number; accountNumber?: string | null };

export default function BankBalancesReportPage() {
  const [data, setData] = useState<{ banks: Bank[]; totalBalance: number; generatedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/finance/bank-balances");
      if (res.ok) setData(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const banksList = data?.banks ?? [];
  const {
    paginatedItems: paginatedBanks,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: banksTotal,
    from,
    to,
  } = usePagination(banksList, [data]);

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
    if (!data?.banks.length) return;
    const headers = ["Code", "Name", "Account Number", "Balance"];
    const rows = data.banks.map((b) => [b.code, b.name, b.accountNumber || "", (b.balance ?? 0).toFixed(2)]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bank_Balances_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Bank Balances Report" />
        <div className="flex gap-2">
          <Link href="/reports/payment">
            <Button variant="outline" size="sm">← All Reports</Button>
          </Link>
          <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>Print</Button>
        </div>
      </div>

      <div className="mb-4 print:block hidden print:mb-2">
        <h1 className="text-xl font-bold text-gray-900">Bank Balances Report</h1>
        <p className="text-sm text-gray-600">Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : data ? (
          <>
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bank balances</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Total balance{" "}
                <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                  ${data.totalBalance.toLocaleString()}
                </span>
              </p>
            </div>
            {bankChart.categories.length > 0 && (
              <div className="no-print border-b border-gray-200 px-6 py-6 dark:border-gray-800">
                <FinanceReportBar
                  title="Balance by bank code"
                  categories={bankChart.categories}
                  data={bankChart.values}
                  color="#0f766e"
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>#</TableCell>
                    <TableCell isHeader>Code</TableCell>
                    <TableCell isHeader>Bank Name</TableCell>
                    <TableCell isHeader>Account Number</TableCell>
                    <TableCell isHeader className="text-right">Balance</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBanks.map((b, idx) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-gray-500">{(page - 1) * pageSize + idx + 1}</TableCell>
                      <TableCell className="font-mono font-medium">{b.code}</TableCell>
                      <TableCell>{b.name}</TableCell>
                      <TableCell>{b.accountNumber || "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
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
                total={banksTotal}
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
