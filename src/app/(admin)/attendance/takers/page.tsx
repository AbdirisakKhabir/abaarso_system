"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { globalRowIndex, usePagination } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

const SHIFTS = ["Morning", "Afternoon", "Evening"];

type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  departmentId: number;
  department: { id: number; name: string; code: string };
};
type CourseOption = { id: number; name: string; code: string; departmentId: number };
type LecturerOption = { id: number; name: string; email: string };

type TakerRow = {
  id: number;
  classId: number;
  courseId: number;
  lecturerId: number;
  shift: string;
  isActive: boolean;
  class: ClassOption;
  course: { id: number; code: string; name: string };
  lecturer: LecturerOption;
  assignedBy: { id: number; name: string | null; email: string };
  createdAt: string;
};

type FormState = {
  classId: string;
  courseId: string;
  lecturerId: string;
  shift: string;
};

const emptyForm: FormState = {
  classId: "",
  courseId: "",
  lecturerId: "",
  shift: SHIFTS[0],
};

export default function AttendanceTakersPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<TakerRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [lecturersByCourse, setLecturersByCourse] = useState<
    Record<number, LecturerOption[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [filterDepartmentId, setFilterDepartmentId] = useState("all");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission("attendance.assign.create");
  const canEdit = hasPermission("attendance.assign.edit");
  const canDelete = hasPermission("attendance.assign.delete");

  const loadRows = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterDepartmentId !== "all") {
      params.set("departmentId", filterDepartmentId);
    }
    const res = await authFetch(`/api/attendance-takers?${params.toString()}`);
    if (res.ok) setRows(await res.json());
    else setRows([]);
  }, [filterDepartmentId]);

  const loadDepartments = useCallback(async () => {
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
  }, []);

  const loadClassesAndCourses = useCallback(async () => {
    const [classRes, courseRes] = await Promise.all([
      authFetch("/api/classes?active=true"),
      authFetch("/api/courses?active=true"),
    ]);
    if (classRes.ok) {
      const data = await classRes.json();
      setClasses(
        data.map((c: ClassOption & Record<string, unknown>) => ({
          id: c.id,
          name: c.name,
          semester: c.semester,
          year: c.year,
          departmentId: c.departmentId,
          department: c.department,
        }))
      );
    }
    if (courseRes.ok) {
      const data = await courseRes.json();
      setCourses(
        data.map((c: CourseOption) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          departmentId: c.departmentId,
        }))
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadDepartments(), loadClassesAndCourses()]);
      setLoading(false);
    })();
  }, [loadDepartments, loadClassesAndCourses]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => rows, [rows]);

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
  } = usePagination(filtered, [filterDepartmentId]);

  const selectedClass = classes.find((c) => String(c.id) === form.classId);
  const coursesForClass = selectedClass
    ? courses.filter((c) => c.departmentId === selectedClass.departmentId)
    : [];
  const lecturersForCourse = form.courseId
    ? lecturersByCourse[Number(form.courseId)] ?? []
    : [];

  async function loadLecturersForCourse(courseId: number) {
    if (lecturersByCourse[courseId]) return;
    const res = await authFetch(`/api/lecturers/by-course/${courseId}`);
    if (res.ok) {
      const data = await res.json();
      setLecturersByCourse((prev) => ({ ...prev, [courseId]: data }));
    }
  }

  function openAdd() {
    setModal("add");
    setEditingId(null);
    setForm(emptyForm);
    setSubmitError("");
  }

  function openEdit(row: TakerRow) {
    setModal("edit");
    setEditingId(row.id);
    setForm({
      classId: String(row.classId),
      courseId: String(row.courseId),
      lecturerId: String(row.lecturerId),
      shift: row.shift,
    });
    setSubmitError("");
    void loadLecturersForCourse(row.courseId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!form.classId || !form.courseId || !form.lecturerId || !form.shift) {
      setSubmitError("Class, course, lecturer, and shift are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        classId: Number(form.classId),
        courseId: Number(form.courseId),
        lecturerId: Number(form.lecturerId),
        shift: form.shift,
      };
      const url =
        modal === "edit" && editingId
          ? `/api/attendance-takers/${editingId}`
          : "/api/attendance-takers";
      const method = modal === "edit" ? "PATCH" : "POST";
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to save assignment");
        return;
      }
      await loadRows();
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this attendance taker assignment?")) return;
    const res = await authFetch(`/api/attendance-takers/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await loadRows();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  async function handleToggleActive(row: TakerRow) {
    const res = await authFetch(`/api/attendance-takers/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    if (res.ok) await loadRows();
    else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  }

  if (!hasPermission("attendance.assign.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Attendance Takers" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view attendance taker assignments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Attendance Takers" />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/attendance"
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3"
          >
            ← Attendance sessions
          </Link>
          {canCreate && (
            <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
              Assign lecturer
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/50 px-5 py-4 dark:border-brand-500/20 dark:bg-brand-500/5">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Assign a lecturer to take attendance for a specific class, course, and shift.
          Only assigned lecturers (or admins) can take or edit attendance for that combination.
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Assignments
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {filtered.length}
            </span>
          </div>
          <select
            value={filterDepartmentId}
            onChange={(e) => setFilterDepartmentId(e.target.value)}
            className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No attendance taker assignments yet.
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={openAdd}
                className="mt-3 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Assign a lecturer
              </button>
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
                  <TableCell isHeader>Shift</TableCell>
                  <TableCell isHeader>Lecturer</TableCell>
                  <TableCell isHeader>Status</TableCell>
                  <TableCell isHeader className="text-right">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                      {globalRowIndex(page, pageSize, idx)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white/90">
                          {row.class.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {row.class.department.code} · {row.class.semester} {row.class.year}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {row.course.code}
                        </p>
                        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                          {row.course.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={
                          row.shift === "Morning"
                            ? "info"
                            : row.shift === "Afternoon"
                              ? "warning"
                              : "primary"
                        }
                        size="sm"
                      >
                        {row.shift}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {row.lecturer.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {row.lecturer.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleToggleActive(row)}
                        className="disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Badge color={row.isActive ? "success" : "light"} size="sm">
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                            aria-label="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
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

      {modal && (
        <ModalOverlayGate>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10 backdrop-blur-sm">
            <div className="w-full min-w-0 max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <form onSubmit={handleSubmit}>
                <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {modal === "add" ? "Assign attendance taker" : "Edit assignment"}
                  </h2>
                </div>
                <div className="space-y-4 px-6 py-5">
                  {submitError && (
                    <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                      {submitError}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Class <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      value={form.classId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({
                          ...f,
                          classId: v,
                          courseId: "",
                          lecturerId: "",
                        }));
                      }}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white"
                    >
                      <option value="">Select class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} · {c.semester} {c.year} ({c.department.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Course <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!form.classId}
                      value={form.courseId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({ ...f, courseId: v, lecturerId: "" }));
                        if (v) void loadLecturersForCourse(Number(v));
                      }}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 disabled:opacity-50 dark:border-gray-700 dark:text-white"
                    >
                      <option value="">
                        {!form.classId ? "Select class first" : "Select course"}
                      </option>
                      {coursesForClass.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Lecturer <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!form.courseId}
                      value={form.lecturerId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lecturerId: e.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 disabled:opacity-50 dark:border-gray-700 dark:text-white"
                    >
                      <option value="">
                        {!form.courseId ? "Select course first" : "Select lecturer"}
                      </option>
                      {lecturersForCourse.map((l) => (
                        <option key={l.id} value={String(l.id)}>
                          {l.name} ({l.email})
                        </option>
                      ))}
                    </select>
                    {form.courseId && lecturersForCourse.length === 0 && (
                      <p className="mt-1 text-xs text-warning-600 dark:text-warning-400">
                        No lecturers are assigned to teach this course.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Shift <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      value={form.shift}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, shift: e.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white"
                    >
                      {SHIFTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : modal === "add" ? "Assign" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalOverlayGate>
      )}
    </>
  );
}
