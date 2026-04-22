"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { DollarLineIcon, ListIcon, TrashBinIcon } from "@/icons";

export type FinancePaymentRow = {
  id: number;
  amount: number;
  semester: string;
  year: number;
  paymentMethod: string;
  receiptNumber: string | null;
  transactionId: string | null;
  paymentDate: string;
  paidAt: string;
  note: string | null;
  bank: { id: number; name: string; code: string } | null;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    department: { name: string; code: string };
  };
  recordedBy: { id: number; name: string; email: string } | null;
};

function paymentMethodLabel(method: string) {
  switch (method) {
    case "electronic":
      return "Electronic";
    case "cash_on_hand":
      return "Cash on Hand";
    default:
      return "Bank Receipt";
  }
}

function paymentReference(p: FinancePaymentRow) {
  if (p.paymentMethod === "bank_receipt" && p.receiptNumber) return p.receiptNumber;
  if (p.paymentMethod === "electronic" && p.transactionId) return p.transactionId;
  if (p.note?.trim()) return p.note.trim();
  return "—";
}

export default function FinancePaymentsPage() {
  const { hasPermission } = useAuth();
  const [financePayments, setFinancePayments] = useState<FinancePaymentRow[]>([]);
  const [financeTotal, setFinanceTotal] = useState(0);
  const [financePage, setFinancePage] = useState(1);
  const [financePageSize, setFinancePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);

  const canDeletePayment = hasPermission("finance.create");

  const fetchFinancePayments = useCallback(
    async (opts?: { page?: number; pageSize?: number }) => {
      const page = opts?.page ?? financePage;
      const ps = opts?.pageSize ?? financePageSize;
      setFinanceLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(ps),
        });
        const res = await authFetch(`/api/tuition-payments?${params}`);
        if (res.ok) {
          const data = await res.json();
          setFinancePayments(Array.isArray(data.items) ? data.items : []);
          setFinanceTotal(typeof data.total === "number" ? data.total : 0);
        } else {
          setFinancePayments([]);
          setFinanceTotal(0);
        }
      } catch {
        setFinancePayments([]);
        setFinanceTotal(0);
      } finally {
        setFinanceLoading(false);
      }
    },
    [financePage, financePageSize]
  );

  useEffect(() => {
    void fetchFinancePayments();
  }, [fetchFinancePayments]);

  const financeTotalPages = Math.max(1, Math.ceil(financeTotal / financePageSize) || 1);
  const financeFrom =
    financeTotal === 0 ? 0 : (financePage - 1) * financePageSize + 1;
  const financeTo = Math.min(financePage * financePageSize, financeTotal);

  useEffect(() => {
    if (financeTotal > 0 && financePage > financeTotalPages) {
      setFinancePage(financeTotalPages);
    }
  }, [financeTotal, financePage, financeTotalPages]);

  async function handleDeletePayment(p: FinancePaymentRow) {
    if (
      !confirm(
        `Remove this payment of $${Number(p.amount).toLocaleString()} for ${p.student.firstName} ${p.student.lastName} (${p.semester} ${p.year})? Student balance and bank balance will be reversed.`
      )
    ) {
      return;
    }
    setDeletingPaymentId(p.id);
    try {
      const res = await authFetch(`/api/tuition-payments/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not delete payment");
        return;
      }
      await fetchFinancePayments();
    } catch {
      alert("Could not delete payment");
    } finally {
      setDeletingPaymentId(null);
    }
  }

  if (!hasPermission("finance.view") && !hasPermission("admission.view") && !hasPermission("dashboard.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Payments" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to view Payments.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Payments" />

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/finance" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Record payment
        </Link>
        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          ·
        </span>
        <Link href="/finance/banks" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Manage banks
        </Link>
        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          ·
        </span>
        <Link href="/reports/payment" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Finance reports
        </Link>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/3">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <ListIcon className="h-5 w-5 shrink-0 text-brand-500" />
            Tuition payments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            All recorded tuition payments, newest first.
          </p>
        </div>
        <div className="p-0">
          {financeLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : financeTotal === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <DollarLineIcon className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No tuition payments recorded yet.</p>
              <Link
                href="/finance"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Record a payment
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Date</TableCell>
                      <TableCell isHeader>Student</TableCell>
                      <TableCell isHeader>Semester</TableCell>
                      <TableCell isHeader className="text-right">Amount</TableCell>
                      <TableCell isHeader>Method</TableCell>
                      <TableCell isHeader>Bank</TableCell>
                      <TableCell isHeader>Reference</TableCell>
                      <TableCell isHeader>Recorded by</TableCell>
                      {canDeletePayment && <TableCell isHeader className="text-right">Actions</TableCell>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financePayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/students/${encodeURIComponent(p.student.studentId)}`}
                            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {p.student.firstName} {p.student.lastName}
                          </Link>
                          <span className="ml-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                            {p.student.studentId}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.semester} {p.year}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          ${Number(p.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{paymentMethodLabel(p.paymentMethod)}</TableCell>
                        <TableCell>
                          {p.bank ? `${p.bank.code} · ${p.bank.name}` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[140px] text-gray-600 dark:text-gray-300">
                          <span className="block truncate" title={paymentReference(p)}>
                            {paymentReference(p)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {p.recordedBy?.name || "—"}
                        </TableCell>
                        {canDeletePayment && (
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeletePayment(p)}
                              disabled={deletingPaymentId === p.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 disabled:opacity-50 dark:hover:bg-error-500/10"
                              aria-label="Delete payment"
                              title="Delete payment (reverses balance)"
                            >
                              <TrashBinIcon className="h-4 w-4" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={financePage}
                totalPages={financeTotalPages}
                total={financeTotal}
                from={financeFrom}
                to={financeTo}
                pageSize={financePageSize}
                onPageChange={setFinancePage}
                onPageSizeChange={setFinancePageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
