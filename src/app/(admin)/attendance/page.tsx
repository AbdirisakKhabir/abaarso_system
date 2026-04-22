"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
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
import { globalRowIndex, usePagination } from "@/hooks/usePagination";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { PlusIcon, TrashBinIcon } from "@/icons";

type DepartmentOption = {
  id: number;
  name: string;
  code: string;
};

type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; name: string; code: string };
};

type SessionRow = {
  id: number;
  classId: number;
  courseId: number;
  course: { id: number; code: string; name: string };
  class: ClassOption;
  date: string;
  shift: string;
  takenBy: { id: number; name: string | null; email: string };
  takenAt: string;
  note: string | null;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type StudentOption = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
};

type SessionDetail = {
  id: number;
  class: ClassOption;
  course: { id: number; code: string; name: string };
  date: string;
  shift: string;
  takenBy: { id: number; name: string | null; email: string };
  takenAt: string;
  note: string | null;
  records: {
    id: number;
    status: string;
    note: string | null;
    student: StudentOption;
  }[];
};

const STATUS_COLOR: Record<string, "success" | "error" | "warning" | "info"> = {
  Present: "success",
  Absent: "error",
  Late: "warning",
  Excused: "info",
};

export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDepartmentId, setFilterDepartmentId] = useState("all");
  const [filterClassId, setFilterClassId] = useState("all");
  const [viewSession, setViewSession] = useState<SessionDetail | null>(null);

  const canCreate = hasPermission("attendance.create");
  const canDelete = hasPermission("attendance.delete");

  async function loadSessions() {
    const res = await authFetch("/api/attendance");
    if (res.ok) setSessions(await res.json());
  }

  async function loadDepartments() {
    const res = await authFetch("/api/departments?active=true");
    if (res.ok) {
      const data = await res.json();
      setDepartments(
        data.map((d: DepartmentOption) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        }))
      );
    }
  }

  async function loadClassesForFilters() {
    const params = new URLSearchParams();
    params.set("active", "true");
    if (filterDepartmentId && filterDepartmentId !== "all") {
      params.set("departmentId", filterDepartmentId);
    }
    const res = await authFetch(`/api/classes?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setClasses(
        data.map(
          (c: ClassOption & Record<string, unknown>) => ({
            id: c.id,
            name: c.name,
            semester: c.semester,
            year: c.year,
            department: c.department,
          })
        )
      );
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSessions(), loadDepartments()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    void loadClassesForFilters();
  }, [filterDepartmentId]);

  async function handleViewSession(id: number) {
    const res = await authFetch(`/api/attendance/${id}`);
    if (res.ok) setViewSession(await res.json());
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this attendance session?")) return;
    const res = await authFetch(`/api/attendance/${id}`, { method: "DELETE" });
    if (res.ok) await loadSessions();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  const filtered = sessions.filter((s) => {
    if (filterDepartmentId !== "all" && String(s.class.department.id) !== filterDepartmentId)
      return false;
    if (filterClassId !== "all" && String(s.classId) !== filterClassId)
      return false;
    return true;
  });

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: filteredTotal,
    from,
    to,
  } = usePagination(filtered, [filterClassId, filterDepartmentId]);

  if (!hasPermission("attendance.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Attendance" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view attendance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Attendance" />
        {canCreate && (
          <Link
            href="/attendance/take"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300 dark:hover:bg-brand-600"
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            Take attendance
          </Link>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Attendance sessions
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterDepartmentId}
              onChange={(e) => {
                setFilterDepartmentId(e.target.value);
                setFilterClassId("all");
              }}
              className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="h-10 min-w-[220px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
            >
              <option value="all">All active classes</option>
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} · {c.semester} {c.year} ({c.department.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No attendance sessions found.
            </p>
            {canCreate && (
              <Link
                href="/attendance/take"
                className="mt-3 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Take attendance
              </Link>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent! hover:bg-transparent!">
                  <TableCell isHeader>#</TableCell>
                  <TableCell isHeader>Class</TableCell>
                  <TableCell isHeader>Course</TableCell>
                  <TableCell isHeader>Date</TableCell>
                  <TableCell isHeader>Shift</TableCell>
                  <TableCell isHeader>Taken by</TableCell>
                  <TableCell isHeader>Time</TableCell>
                  <TableCell isHeader>Summary</TableCell>
                  <TableCell isHeader className="text-right">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                      {globalRowIndex(page, pageSize, idx)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white/90">
                          {s.class.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {s.class.department.code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {s.course.code}
                        </p>
                        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                          {s.course.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {new Date(s.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={
                          s.shift === "Morning"
                            ? "info"
                            : s.shift === "Afternoon"
                              ? "warning"
                              : "primary"
                        }
                        size="sm"
                      >
                        {s.shift}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {s.takenBy.name || s.takenBy.email}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(s.takenAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-600 dark:bg-success-500/10 dark:text-success-400">
                          {s.present}P
                        </span>
                        {s.absent > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-600 dark:bg-error-500/10 dark:text-error-400">
                            {s.absent}A
                          </span>
                        )}
                        {s.late > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-600 dark:bg-warning-500/10 dark:text-warning-400">
                            {s.late}L
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewSession(s.id)}
                          className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
                        >
                          View
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
                            aria-label="Delete"
                          >
                            <TrashBinIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={filteredTotal}
              from={from}
              to={to}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {viewSession && (
        <ModalOverlayGate>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10 backdrop-blur-sm">
            <div className="w-full min-w-0 max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    Attendance details
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {viewSession.course.code} — {viewSession.course.name} · {viewSession.class.name} ·{" "}
                    {viewSession.class.department.code} ·{" "}
                    {new Date(viewSession.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewSession(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Shift</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white/90">
                    {viewSession.shift}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Taken by</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white/90">
                    {viewSession.takenBy.name || viewSession.takenBy.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Time</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white/90">
                    {new Date(viewSession.takenAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="max-h-[50vh] min-w-0 overflow-auto">
                <table className="min-w-full border-collapse divide-y divide-gray-100 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-white/3">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        #
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Student
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        ID
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {viewSession.records.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-white/2">
                        <td className="px-5 py-3 text-sm text-gray-400">{idx + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {r.student.imageUrl ? (
                              <Image
                                src={r.student.imageUrl}
                                alt=""
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                {r.student.firstName.charAt(0)}
                                {r.student.lastName.charAt(0)}
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                              {r.student.firstName} {r.student.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                          {r.student.studentId}
                        </td>
                        <td className="px-5 py-3">
                          <Badge color={STATUS_COLOR[r.status] || "light"} size="sm">
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="text-success-600 dark:text-success-400">
                    P: {viewSession.records.filter((r) => r.status === "Present").length}
                  </span>
                  <span className="text-error-600 dark:text-error-400">
                    A: {viewSession.records.filter((r) => r.status === "Absent").length}
                  </span>
                  <span className="text-warning-600 dark:text-warning-400">
                    L: {viewSession.records.filter((r) => r.status === "Late").length}
                  </span>
                  <span className="text-blue-light-600 dark:text-blue-light-400">
                    E: {viewSession.records.filter((r) => r.status === "Excused").length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewSession(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3 dark:hover:text-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalOverlayGate>
      )}
    </>
  );
}
