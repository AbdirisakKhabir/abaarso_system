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
import { DateInput } from "@/components/form/DateInput";
import {
  FinanceReportBar,
  FinanceReportDonut,
} from "@/components/reports/FinanceReportChart";

type Bank = { id: number; name: string; code: string };

export default function BankTransactionsReportPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [data, setData] = useState<{
    deposits: { id: number; amount: number; paidAt: string; student: { studentId: string; firstName: string; lastName: string }; bank: { name: string; code: string } }[];
    withdrawals: { id: number; amount: number; withdrawnAt: string; reason: string | null; bank: { name: string; code: string } }[];
    transfersOut: { id: number; amount: number; transferredAt: string; fromBank: { name: string; code: string }; toBank: { name: string; code: string } }[];
    transfersIn: { id: number; amount: number; transferredAt: string; fromBank: { name: string; code: string }; toBank: { name: string; code: string } }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bankId, setBankId] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (bankId) params.set("bankId", bankId);
      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);
      const res = await authFetch(`/api/finance/bank-transactions?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [bankId, dateFrom, dateTo]);

  useEffect(() => {
    authFetch("/api/banks").then((r) => { if (r.ok) r.json().then(setBanks); });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const depositsList = data?.deposits ?? [];
  const withdrawalsList = data?.withdrawals ?? [];
  const transfersSorted = useMemo(() => {
    if (!data) return [];
    return [...data.transfersOut, ...data.transfersIn].sort(
      (a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime()
    );
  }, [data]);

  const transferResetDeps = [bankId, dateFrom, dateTo, data];
  const {
    paginatedItems: paginatedDeposits,
    page: depositsPage,
    setPage: setDepositsPage,
    pageSize: depositsPageSize,
    setPageSize: setDepositsPageSize,
    totalPages: depositsTotalPages,
    total: depositsTotal,
    from: depositsFrom,
    to: depositsTo,
  } = usePagination(depositsList, transferResetDeps);
  const {
    paginatedItems: paginatedWithdrawals,
    page: withdrawalsPage,
    setPage: setWithdrawalsPage,
    pageSize: withdrawalsPageSize,
    setPageSize: setWithdrawalsPageSize,
    totalPages: withdrawalsTotalPages,
    total: withdrawalsTotalCount,
    from: withdrawalsFrom,
    to: withdrawalsTo,
  } = usePagination(withdrawalsList, transferResetDeps);
  const {
    paginatedItems: paginatedTransfers,
    page: transfersPage,
    setPage: setTransfersPage,
    pageSize: transfersPageSize,
    setPageSize: setTransfersPageSize,
    totalPages: transfersTotalPages,
    total: transfersTotalCount,
    from: transfersFrom,
    to: transfersTo,
  } = usePagination(transfersSorted, transferResetDeps);

  const depositTotal = useMemo(
    () => (data ? data.deposits.reduce((s, d) => s + d.amount, 0) : 0),
    [data]
  );
  const withdrawalTotal = useMemo(
    () => (data ? data.withdrawals.reduce((s, w) => s + w.amount, 0) : 0),
    [data]
  );

  const handlePrint = () => window.print();

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Bank Transactions Report" />
        <Link href="/reports/payment">
          <Button variant="outline" size="sm">← All Reports</Button>
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/5 no-print">
        <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">Filters</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Bank</label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Banks</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </select>
          </div>
          <DateInput
            id="bank-tx-from"
            label="From Date"
            labelClassName="mb-1 block text-xs text-gray-500"
            value={dateFrom}
            onChange={setDateFrom}
            inputClassName="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <DateInput
            id="bank-tx-to"
            label="To Date"
            labelClassName="mb-1 block text-xs text-gray-500"
            value={dateTo}
            onChange={setDateTo}
            inputClassName="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div className="mb-4 print:block hidden">
        <h1 className="text-xl font-bold text-gray-900">Bank Transactions Report</h1>
        <p className="text-sm text-gray-600">{dateFrom} to {dateTo}</p>
      </div>

      {data && (data.deposits.length > 0 || data.withdrawals.length > 0) && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
          <div className="overflow-x-auto border-b border-gray-200 px-4 py-4 dark:border-gray-800">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Period summary</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent! hover:bg-transparent!">
                  <TableCell isHeader>Item</TableCell>
                  <TableCell isHeader className="text-right">Amount</TableCell>
                  <TableCell isHeader className="text-center">Transactions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Deposits</TableCell>
                  <TableCell className="text-right tabular-nums">${depositTotal.toLocaleString()}</TableCell>
                  <TableCell className="text-center tabular-nums">{data.deposits.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Withdrawals</TableCell>
                  <TableCell className="text-right tabular-nums">${withdrawalTotal.toLocaleString()}</TableCell>
                  <TableCell className="text-center tabular-nums">{data.withdrawals.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Net (deposits − withdrawals)</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    ${(depositTotal - withdrawalTotal).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="no-print grid gap-6 px-4 py-6 lg:grid-cols-2">
            <FinanceReportDonut
              title="Deposits vs withdrawals"
              labels={["Deposits", "Withdrawals"]}
              series={[depositTotal, withdrawalTotal]}
            />
            <FinanceReportBar
              title="Volume comparison"
              categories={["Deposits", "Withdrawals"]}
              data={[depositTotal, withdrawalTotal]}
              color="#1e40af"
            />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {data && (
          <>
            <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Deposits (tuition payments)</h3>
                {data.deposits.length > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total ${depositTotal.toLocaleString()} · {data.deposits.length} items
                  </span>
                )}
              </div>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
                </div>
              ) : data.deposits.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No deposits in this period.</div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Date</TableCell>
                      <TableCell isHeader>Student</TableCell>
                      <TableCell isHeader>Bank</TableCell>
                      <TableCell isHeader className="text-right">Amount</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDeposits.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{new Date(d.paidAt).toLocaleDateString()}</TableCell>
                        <TableCell>{d.student?.firstName} {d.student?.lastName} ({d.student?.studentId})</TableCell>
                        <TableCell>{d.bank?.code}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">+${d.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                      <TableCell colSpan={3} className="text-right">Total</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        +${data.deposits.reduce((s, d) => s + d.amount, 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <TablePagination
                  className="no-print"
                  page={depositsPage}
                  totalPages={depositsTotalPages}
                  total={depositsTotal}
                  from={depositsFrom}
                  to={depositsTo}
                  pageSize={depositsPageSize}
                  onPageChange={setDepositsPage}
                  onPageSizeChange={setDepositsPageSize}
                />
                </>
              )}
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Withdrawals</h3>
                {data.withdrawals.length > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total ${withdrawalTotal.toLocaleString()} · {data.withdrawals.length} items
                  </span>
                )}
              </div>
              {data.withdrawals.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No withdrawals in this period.</div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Date</TableCell>
                      <TableCell isHeader>Bank</TableCell>
                      <TableCell isHeader>Reason</TableCell>
                      <TableCell isHeader className="text-right">Amount</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedWithdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{new Date(w.withdrawnAt).toLocaleDateString()}</TableCell>
                        <TableCell>{w.bank?.code}</TableCell>
                        <TableCell>{w.reason || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">-${w.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                      <TableCell colSpan={3} className="text-right">Total</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        -${data.withdrawals.reduce((s, w) => s + w.amount, 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <TablePagination
                  className="no-print"
                  page={withdrawalsPage}
                  totalPages={withdrawalsTotalPages}
                  total={withdrawalsTotalCount}
                  from={withdrawalsFrom}
                  to={withdrawalsTo}
                  pageSize={withdrawalsPageSize}
                  onPageChange={setWithdrawalsPage}
                  onPageSizeChange={setWithdrawalsPageSize}
                />
                </>
              )}
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                <h3 className="font-semibold text-gray-800 dark:text-white/90">Transfers</h3>
              </div>
              {data.transfersOut.length === 0 && data.transfersIn.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No transfers in this period.</div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Date</TableCell>
                      <TableCell isHeader>From</TableCell>
                      <TableCell isHeader>To</TableCell>
                      <TableCell isHeader className="text-right">Amount</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransfers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.transferredAt).toLocaleDateString()}</TableCell>
                        <TableCell>{t.fromBank?.code}</TableCell>
                        <TableCell>{t.toBank?.code}</TableCell>
                        <TableCell className="text-right font-medium">${t.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  className="no-print"
                  page={transfersPage}
                  totalPages={transfersTotalPages}
                  total={transfersTotalCount}
                  from={transfersFrom}
                  to={transfersTo}
                  pageSize={transfersPageSize}
                  onPageChange={setTransfersPage}
                  onPageSizeChange={setTransfersPageSize}
                />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
