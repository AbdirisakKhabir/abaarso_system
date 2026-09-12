"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { programLabel } from "@/lib/program";
import { PAYMENT_STATUSES } from "@/lib/tuition-amount";
import { confirmYesNo, notifyError, notifySuccess } from "@/lib/sweetalert";

type Department = { id: number; name: string; code: string; tuitionFee: number | null };
type ClassOption = { id: number; name: string; semester: string; year: number };

type Registration = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  program: string;
  status: "Pending" | "Approved" | "Rejected";
  paymentStatus: string | null;
  customSemesterFee: number | null;
  department: Department;
  class: ClassOption | null;
  student: { id: number; studentId: string } | null;
  reviewedBy: { id: number; name: string | null; email: string } | null;
  createdAt: string;
};

const STATUS_TABS = ["Pending", "Approved", "Rejected", "all"] as const;

const STATUS_COLOR: Record<string, "warning" | "success" | "error"> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "error",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const selectCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90";
const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90";

export default function OnlineRegistrationPage() {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission("admission.create");
  const canReject = hasPermission("admission.edit");

  const [items, setItems] = useState<Registration[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>("Pending");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const [approveTarget, setApproveTarget] = useState<Registration | null>(null);
  const [approveClasses, setApproveClasses] = useState<ClassOption[]>([]);
  const [approvePaymentStatus, setApprovePaymentStatus] = useState<string>("Fully Paid");
  const [approveFee, setApproveFee] = useState("");
  const [approveClassId, setApproveClassId] = useState("");
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [approveError, setApproveError] = useState("");

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusTab);
      if (search.trim()) params.set("q", search.trim());
      const res = await authFetch(`/api/online-registrations?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPendingCount(typeof data?.pendingCount === "number" ? data.pendingCount : 0);
    } finally {
      setLoading(false);
    }
  }, [statusTab, search]);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  function openApprove(reg: Registration) {
    setApproveTarget(reg);
    setApprovePaymentStatus("Fully Paid");
    setApproveFee("");
    setApproveClassId("");
    setApproveError("");
    setApproveClasses([]);
    authFetch(
      `/api/classes?departmentId=${reg.department.id}&program=${encodeURIComponent(reg.program)}&active=true`
    ).then((r) => {
      if (!r.ok) return;
      r.json().then((d: ClassOption[] | { items?: ClassOption[] }) => {
        setApproveClasses(Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : []);
      });
    });
  }

  async function submitApprove() {
    if (!approveTarget) return;
    setApproveSubmitting(true);
    setApproveError("");
    try {
      const res = await authFetch(`/api/online-registrations/${approveTarget.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: approvePaymentStatus,
          customSemesterFee: approveFee.trim() === "" ? null : approveFee,
          classId: approveClassId || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setApproveError(data?.error ?? "Could not approve this application.");
        return;
      }
      const studentId = data?.student?.studentId;
      setApproveTarget(null);
      await loadRegistrations();
      await notifySuccess(
        "Application approved",
        studentId ? `${approveTarget.firstName} ${approveTarget.lastName} was admitted as ${studentId}.` : undefined
      );
    } catch {
      setApproveError("Could not approve this application.");
    } finally {
      setApproveSubmitting(false);
    }
  }

  async function handleReject(reg: Registration) {
    if (!canReject) return;
    const ok = await confirmYesNo({
      title: "Reject this application?",
      text: `${reg.firstName} ${reg.lastName}'s online application will be marked as rejected.`,
      confirmText: "Yes, reject",
      cancelText: "No",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setError("");
    setRejectingId(reg.id);
    try {
      const res = await authFetch(`/api/online-registrations/${reg.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        await notifyError("Could not reject application", data?.error);
        return;
      }
      await loadRegistrations();
      await notifySuccess("Application rejected");
    } catch {
      setError("Could not reject application.");
      await notifyError("Could not reject application");
    } finally {
      setRejectingId(null);
    }
  }

  if (!hasPermission("admission.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Online Registration" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500">You do not have permission to view online registrations.</p>
        </div>
      </div>
    );
  }

  const effectiveFee =
    approveTarget && approveFee.trim() !== "" && Number.isFinite(Number(approveFee))
      ? Number(approveFee)
      : approveTarget
        ? (() => {
            const base = approveTarget.department.tuitionFee ?? 0;
            if (approvePaymentStatus === "Full Scholarship") return 0;
            if (approvePaymentStatus === "Half Scholar") return base * 0.5;
            return base;
          })()
        : 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Online Registration" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <strong className="text-gray-800 dark:text-white/90">{pendingCount}</strong> pending application(s)
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap rounded-lg border border-gray-200 p-1 dark:border-gray-700">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  statusTab === tab
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {tab === "all" ? "All" : tab}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone"
            className={`${inputCls} sm:w-64`}
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No applications found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>Applicant</TableCell>
                <TableCell isHeader>Contact</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Program</TableCell>
                <TableCell isHeader>Submitted</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {reg.firstName} {reg.lastName}
                    </p>
                    {reg.student && (
                      <p className="font-mono text-xs text-gray-500">{reg.student.studentId}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    <p>{reg.email || "—"}</p>
                    <p>{reg.phone || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge color="info" size="sm">{reg.department.code}</Badge>
                    <p className="mt-0.5 text-xs text-gray-400">{reg.department.name}</p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    {programLabel(reg.program as "Bachelor" | "Masters")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtDate(reg.createdAt)}</TableCell>
                  <TableCell>
                    <Badge color={STATUS_COLOR[reg.status]} size="sm">{reg.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {reg.status === "Pending" ? (
                      <div className="inline-flex items-center gap-2">
                        {canApprove && (
                          <Button size="sm" onClick={() => openApprove(reg)}>
                            Approve
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleReject(reg)}
                            disabled={rejectingId === reg.id}
                            className="text-error-600 border-error-200 hover:bg-error-50 dark:border-error-800 dark:text-error-400 dark:hover:bg-error-500/10"
                          >
                            {rejectingId === reg.id ? "Rejecting…" : "Reject"}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {reg.reviewedBy?.name || reg.reviewedBy?.email || "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {approveTarget && (
        <ModalOverlayGate>
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Approve application
                </h2>
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-800 dark:text-white/90">
                    {approveTarget.firstName} {approveTarget.lastName}
                  </strong>{" "}
                  will be admitted into <strong>{approveTarget.department.name}</strong> (
                  {programLabel(approveTarget.program as "Bachelor" | "Masters")}). Choose a payment status,
                  fee, and class.
                </p>

                {approveError && (
                  <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                    {approveError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Payment status
                  </label>
                  <select
                    value={approvePaymentStatus}
                    onChange={(e) => setApprovePaymentStatus(e.target.value)}
                    className={selectCls}
                  >
                    {PAYMENT_STATUSES.map((ps) => (
                      <option key={ps} value={ps}>{ps}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fee per semester ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={approveFee}
                    onChange={(e) => setApproveFee(e.target.value)}
                    placeholder={`Default: $${effectiveFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Leave blank to use the department fee for the selected payment status. This becomes the
                    student&apos;s opening balance.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Allocate to class
                  </label>
                  <select
                    value={approveClassId}
                    onChange={(e) => setApproveClassId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">No class (assign later)</option>
                    {approveClasses.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} ({c.semester} {c.year})
                      </option>
                    ))}
                  </select>
                  {approveClasses.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      No active classes found for this department/program yet.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <Button variant="outline" size="sm" onClick={() => setApproveTarget(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void submitApprove()} disabled={approveSubmitting}>
                  {approveSubmitting ? "Approving…" : "Approve & create student"}
                </Button>
              </div>
            </div>
          </div>
        </ModalOverlayGate>
      )}
    </div>
  );
}
