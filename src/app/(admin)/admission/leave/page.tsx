"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { DateInput } from "@/components/form/DateInput";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { programLabel } from "@/lib/program";
import { Search } from "lucide-react";

type Department = { id: number; name: string; code: string };
type SearchStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  status: string;
  department?: { code: string; name: string };
  class?: { name: string } | null;
};
type LeaveRow = {
  id: number;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  recordedBy: { name: string | null; email: string } | null;
  student: {
    id: number;
    studentId: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    status: string;
    program: string;
    department: { id: number; name: string; code: string };
    class: { id: number; name: string; semester: string; year: number } | null;
  };
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

export default function LeaveStudentsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("admission.edit");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [currentCount, setCurrentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"current" | "history">("current");
  const [filterDept, setFilterDept] = useState("");
  const [search, setSearch] = useState("");

  const [picked, setPicked] = useState<SearchStudent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await authFetch(`/api/students/search?q=${encodeURIComponent(q)}&limit=15`);
        setSearchResults(res.ok ? await res.json() : []);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 280);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const putOnLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked || !canEdit) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch("/api/students/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: picked.id,
          startDate: leaveStart,
          reason: leaveReason,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not put student on leave.");
        return;
      }
      setMessage(`${picked.studentId} is now on leave.`);
      setPicked(null);
      setSearchQuery("");
      setLeaveReason("");
      await loadLeaves();
    } catch {
      setError("Could not put student on leave.");
    } finally {
      setSubmitting(false);
    }
  };

  const returnFromLeave = async (row: LeaveRow) => {
    if (!canEdit) return;
    if (!window.confirm(`Return ${row.student.studentId} from leave as Admitted?`)) return;
    setError("");
    try {
      const res = await authFetch(`/api/students/leaves/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Admitted" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not return student.");
        return;
      }
      setMessage(`${row.student.studentId} returned from leave.`);
      await loadLeaves();
    } catch {
      setError("Could not return student.");
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
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <strong className="text-gray-800 dark:text-white/90">{currentCount}</strong> currently on leave
        </p>
      </div>

      {canEdit && (
        <form
          onSubmit={putOnLeave}
          className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Put a student on leave</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Status becomes Leave. They stay assigned to their class but are tracked here until they return.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Student</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={picked ? `${picked.firstName} ${picked.lastName} (${picked.studentId})` : searchQuery}
                  onChange={(e) => {
                    setPicked(null);
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="Search name or student ID"
                  className={`${inputCls} pl-9`}
                />
              </div>
              {searchLoading && <p className="mt-1 text-xs text-gray-400">Searching…</p>}
              {!picked && searchResults.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  {searchResults.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                        onClick={() => {
                          setPicked(s);
                          setSearchResults([]);
                        }}
                      >
                        <span>
                          {s.firstName} {s.lastName}{" "}
                          <span className="font-mono text-xs text-gray-500">{s.studentId}</span>
                        </span>
                        <span className="text-xs text-gray-500">{s.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DateInput
              id="leave-start"
              label={<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Leave start</span>}
              value={leaveStart}
              onChange={setLeaveStart}
              inputClassName={inputCls}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                rows={3}
                placeholder="Why is this student on leave?"
                className="min-h-[5rem] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
            <p className="text-sm text-error-600">{error}</p>
            <Button type="submit" size="sm" disabled={!picked || submitting}>
              {submitting ? "Saving…" : "Put on leave"}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      )}

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
                <TableCell isHeader>Start</TableCell>
                <TableCell isHeader>End</TableCell>
                <TableCell isHeader>Reason</TableCell>
                {canEdit && view === "current" && <TableCell isHeader className="text-right">Actions</TableCell>}
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
                  <TableCell className="whitespace-nowrap text-sm">{fmtDate(row.startDate)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.endDate ? fmtDate(row.endDate) : <Badge color="warning" size="sm">Open</Badge>}
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-sm text-gray-600 dark:text-gray-400">
                    {row.reason || "—"}
                  </TableCell>
                  {canEdit && view === "current" && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => void returnFromLeave(row)}>
                        Return
                      </Button>
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
