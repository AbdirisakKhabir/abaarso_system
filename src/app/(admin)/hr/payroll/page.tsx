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
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeftIcon, PlusIcon } from "@/icons";

type Payroll = {
  id: number;
  amount: number;
  description: string;
  period: string | null;
  status: string;
  requestedBy: { id: number; name: string | null; email: string };
  approvedBy: { id: number; name: string | null; email: string } | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  bank: { id: number; name: string; code: string } | null;
  employee: { id: number; name: string; email: string; position: { name: string } } | null;
  createdAt: string;
};

type Bank = { id: number; name: string; code: string };
type Employee = { id: number; name: string; email: string; position: { name: string } };

const STATUS_COLOR: Record<string, "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

const CURRENT_YEAR = new Date().getFullYear();

export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [modal, setModal] = useState<"add" | "reject" | null>(null);
  const [rejectPayrollId, setRejectPayrollId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formBankId, setFormBankId] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const canCreate = hasPermission("payroll.create");
  const canApprove = hasPermission("payroll.approve");
  const canView = hasPermission("payroll.view") || canCreate || canApprove;

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (yearFilter) params.set("year", yearFilter);
      const res = await authFetch(`/api/payroll?${params}`);
      if (res.ok) setPayrolls(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [statusFilter, yearFilter]);

  useEffect(() => {
    fetchPayrolls();
  }, [fetchPayrolls]);

  useEffect(() => {
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d: Bank[]) => {
        setBanks(d);
        if (d.length > 0 && !formBankId) setFormBankId(String(d[0].id));
      });
    });
    authFetch("/api/hr/employees").then((r) => {
      if (r.ok) r.json().then((d: Employee[]) => setEmployees(d));
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const res = await authFetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(formAmount),
          description: formDescription.trim(),
          period: formPeriod.trim() || undefined,
          employeeId: formEmployeeId ? Number(formEmployeeId) : undefined,
          bankId: formBankId ? Number(formBankId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create payroll request");
        return;
      }
      await fetchPayrolls();
      setModal(null);
      setFormAmount("");
      setFormDescription("");
      setFormPeriod("");
      setFormEmployeeId("");
    } catch {
      setFormError("Network error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await authFetch(`/api/payroll/${id}/approve`, { method: "PATCH" });
      if (res.ok) await fetchPayrolls();
      else {
        const data = await res.json();
        alert(data.error || "Failed to approve");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectPayrollId) return;
    try {
      const res = await authFetch(`/api/payroll/${rejectPayrollId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() || undefined }),
      });
      if (res.ok) {
        await fetchPayrolls();
        setModal(null);
        setRejectPayrollId(null);
        setRejectReason("");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reject");
      }
    } catch {
      alert("Network error");
    }
  };

  const openRejectModal = (id: number) => {
    setRejectPayrollId(id);
    setRejectReason("");
    setModal("reject");
  };

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: payrollTotal,
    from,
    to,
  } = usePagination(payrolls, [statusFilter, yearFilter]);

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Payroll Requests" />
        <p className="text-gray-500 dark:text-gray-400">You do not have permission to view payroll.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageBreadCrumb pageTitle="Payroll Requests" />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/hr">
            <Button variant="outline" size="sm" startIcon={<ChevronLeftIcon />}>
              Back to HR
            </Button>
          </Link>
          {canCreate && (
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal("add")}>
              Request Payroll
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>Date</TableCell>
                <TableCell isHeader>Description</TableCell>
                <TableCell isHeader>Employee</TableCell>
                <TableCell isHeader>Period</TableCell>
                <TableCell isHeader>Bank</TableCell>
                <TableCell isHeader className="text-right">Amount</TableCell>
                <TableCell isHeader>Requested By</TableCell>
                <TableCell isHeader>Status</TableCell>
                {canApprove && <TableCell isHeader className="text-right">Actions</TableCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canApprove ? 9 : 8} className="py-12 text-center text-gray-500">
                    No payroll requests found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="max-w-[180px] truncate" title={p.description}>{p.description}</div>
                      {p.rejectionReason && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400" title={p.rejectionReason}>
                          Reason: {p.rejectionReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{p.employee ? `${p.employee.name} (${p.employee.position?.name})` : "—"}</TableCell>
                    <TableCell>{p.period || "—"}</TableCell>
                    <TableCell>{p.bank ? `${p.bank.code}` : "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                      ${p.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{p.requestedBy?.name || p.requestedBy?.email || "—"}</TableCell>
                    <TableCell>
                      <Badge color={STATUS_COLOR[p.status] || "info"} size="sm">
                        {p.status}
                      </Badge>
                    </TableCell>
                    {canApprove && (
                      <TableCell className="text-right">
                        {p.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openRejectModal(p.id)}>
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(p.id)}>
                              Approve
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={payrollTotal}
            from={from}
            to={to}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          </>
        )}
      </div>

      {/* Add Payroll Modal */}
      {modal === "add" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold">Request Payroll</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div>
                <label className="mb-1 block text-sm font-medium">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="e.g. Monthly salary, Bonus"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Period (optional)</label>
                <input
                  type="text"
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
                  placeholder="e.g. January 2026, Q1 2026"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Employee (optional)</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">— Select —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.position?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bank (optional)</label>
                <select
                  value={formBankId}
                  onChange={(e) => setFormBankId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">— Select —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={formSubmitting}>
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={() => setModal(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}

      {/* Reject Modal */}
      {modal === "reject" && rejectPayrollId && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold">Reject Payroll</h3>
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Provide a reason for rejection"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  Reject
                </Button>
                <Button type="button" variant="outline" onClick={() => { setModal(null); setRejectPayrollId(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}
    </div>
  );
}
