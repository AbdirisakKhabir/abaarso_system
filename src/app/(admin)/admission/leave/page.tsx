"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { programLabel } from "@/lib/program";
import { confirmYesNo, notifyError, notifySuccess } from "@/lib/sweetalert";
import StudentLeaveForm, { type LeaveFormRecord } from "@/components/admission/StudentLeaveForm";

type Department = { id: number; name: string; code: string };
type LeaveRow = LeaveFormRecord & {
  endDate: string | null;
  recordedBy: { name: string | null; email: string } | null;
  student: LeaveFormRecord["student"] & {
    department: { id: number; name: string; code: string };
    class: { id: number; name: string; semester: string; year: number } | null;
  };
};

/** Leave dates are stored at UTC midnight, so format them in UTC. */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function leaveTypeLabel(row: LeaveRow) {
  if (!row.leaveType) return "—";
  if (row.leaveType === "Other") return row.leaveTypeOther ? `Other: ${row.leaveTypeOther}` : "Other";
  return row.leaveType;
}

function leaveState(row: LeaveRow): { label: string; color: "warning" | "success" | "error" | "light" } {
  if (row.approvalStatus === "Rejected") return { label: "Not approved", color: "error" };
  if (row.endDate) return { label: "Returned", color: "success" };
  const todayUtc = new Date().toISOString().split("T")[0];
  if (row.expectedEndDate && row.expectedEndDate.split("T")[0] < todayUtc) {
    return { label: "Leave ended — recover", color: "light" };
  }
  return { label: "On leave", color: "warning" };
}

const selectCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90";
const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90";

export default function LeaveStudentsPage() {
  return (
    <Suspense fallback={null}>
      <LeaveStudentsContent />
    </Suspense>
  );
}

function LeaveStudentsContent() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentParam = searchParams.get("student");
  const canEdit = hasPermission("admission.edit");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [currentCount, setCurrentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"current" | "history">("current");
  const [filterDept, setFilterDept] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [recoveringId, setRecoveringId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRow | null>(null);

  // Opened from the student list "Put on leave" action (?student=STD-…)
  useEffect(() => {
    if (studentParam && canEdit) setFormOpen(true);
  }, [studentParam, canEdit]);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    if (studentParam) router.replace("/admission/leave");
  };

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("current", view === "current" ? "true" : "false");
      if (filterDept) params.set("departmentId", filterDept);
      if (search.trim()) params.set("q", search.trim());
      const res = await authFetch(`/api/students/leaves?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLeaves([]);
        return;
      }
      setLeaves(Array.isArray(data?.leaves) ? data.leaves : []);
      setCurrentCount(typeof data?.currentCount === "number" ? data.currentCount : 0);
    } finally {
      setLoading(false);
    }
  }, [view, filterDept, search]);

  useEffect(() => {
    authFetch("/api/departments").then((r) => {
      if (!r.ok) return;
      r.json().then((d: Department[] | { items?: Department[] }) => {
        setDepartments(Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : []);
      });
    });
  }, []);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const returnFromLeave = async (row: LeaveRow) => {
    if (!canEdit) return;
    const ok = await confirmYesNo({
      title: "Recover this student?",
      text: `${row.student.firstName} ${row.student.lastName} (${row.student.studentId}) will be set back to Admitted and removed from the leave list.`,
      confirmText: "Yes, recover",
      cancelText: "No",
      icon: "question",
    });
    if (!ok) return;
    setError("");
    setRecoveringId(row.id);
    try {
      const res = await authFetch(`/api/students/leaves/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Admitted" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error ?? "Could not recover student.";
        setError(msg);
        await notifyError("Could not recover student", msg);
        return;
      }
      await loadLeaves();
      await notifySuccess("Student recovered", `${row.student.studentId} is now Admitted.`);
    } catch {
      setError("Could not recover student.");
      await notifyError("Could not recover student");
    } finally {
      setRecoveringId(null);
    }
  };

  if (!hasPermission("admission.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Leave Students" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500">You do not have permission to view leave students.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Leave Students" />
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong className="text-gray-800 dark:text-white/90">{currentCount}</strong> currently on leave
          </p>
          {canEdit && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              New leave request
            </Button>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Record a Student Leave Form here. While a leave is ongoing (start date to end date), the
        student&apos;s attendance is always marked <strong>Present</strong>.
      </p>

      {(formOpen || editing) && (
        <StudentLeaveForm
          leave={editing}
          initialStudentCode={editing ? null : studentParam}
          onClose={closeForm}
          onSaved={() => {
            closeForm();
            void loadLeaves();
          }}
        />
      )}

      {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setView("current")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "current"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              On leave now
            </button>
            <button
              type="button"
              onClick={() => setView("history")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "history"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Leave history
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className={selectCls}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leave list"
              className={`${inputCls} sm:w-52`}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
        ) : leaves.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            {view === "current" ? "No students are on leave." : "No leave records found."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>Student</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Class</TableCell>
                <TableCell isHeader>Leave type</TableCell>
                <TableCell isHeader>Period</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader>Reason</TableCell>
                {canEdit && <TableCell isHeader className="text-right">Actions</TableCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/students/${encodeURIComponent(row.student.studentId)}`}
                      className="font-medium text-gray-800 hover:underline dark:text-white/90"
                    >
                      {row.student.firstName} {row.student.lastName}
                    </Link>
                    <p className="font-mono text-xs text-gray-500">{row.student.studentId}</p>
                    <p className="text-xs text-gray-400">{programLabel(row.student.program as "Bachelor" | "Masters")}</p>
                  </TableCell>
                  <TableCell>
                    <Badge color="info" size="sm">{row.student.department.code}</Badge>
                    <p className="mt-0.5 text-xs text-gray-400">{row.student.department.name}</p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    {row.student.class
                      ? `${row.student.class.name} · ${row.student.class.semester} ${row.student.class.year}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 dark:text-gray-300">{leaveTypeLabel(row)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {fmtDate(row.startDate)} → {row.expectedEndDate ? fmtDate(row.expectedEndDate) : "—"}
                    {row.endDate && row.approvalStatus !== "Rejected" && (
                      <p className="text-xs text-gray-400">Returned {fmtDate(row.endDate)}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge color={leaveState(row).color} size="sm">
                      {leaveState(row).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-sm text-gray-600 dark:text-gray-400">
                    {row.reason || "—"}
                    {row.documentUrl && (
                      <a
                        href={row.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Supporting document
                      </a>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                          Edit
                        </Button>
                        {!row.endDate && row.approvalStatus !== "Rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void returnFromLeave(row)}
                            disabled={recoveringId === row.id}
                          >
                            {recoveringId === row.id ? "Recovering…" : "Recover"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
