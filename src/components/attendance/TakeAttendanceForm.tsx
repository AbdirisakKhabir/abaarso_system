"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { DateInput } from "@/components/form/DateInput";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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

type CourseMeta = { id: number; code: string; name: string; creditHours: number };
type SemesterMeta = { id: number; name: string; sortOrder: number };

type StudentOption = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
};

type RecordEntry = {
  studentId: number;
  student: StudentOption;
  status: string;
  note: string;
};

const SHIFTS = ["Morning", "Afternoon", "Evening"];
const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused"];

type TakeAttendanceFormProps = {
  onSuccess?: () => void;
};

export default function TakeAttendanceForm({ onSuccess }: TakeAttendanceFormProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("attendance.create");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [takeForm, setTakeForm] = useState({
    departmentId: "",
    semesterName: "",
    year: "",
    classId: "",
    courseId: "",
    date: new Date().toISOString().split("T")[0],
    shift: "Morning",
    note: "",
  });
  const [takeClasses, setTakeClasses] = useState<ClassOption[]>([]);
  const [takeContextCourses, setTakeContextCourses] = useState<CourseMeta[]>([]);
  const [takeContextSemesters, setTakeContextSemesters] = useState<SemesterMeta[]>([]);
  const [loadingTakeContext, setLoadingTakeContext] = useState(false);
  const [students, setStudents] = useState<RecordEntry[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const departmentCoursesSorted = useMemo(
    () =>
      [...takeContextCourses].sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { sensitivity: "base" })
      ),
    [takeContextCourses]
  );

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

  useEffect(() => {
    void loadDepartments();
  }, []);

  async function loadStudentsForClass(classId: string) {
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const res = await authFetch(
        `/api/students?status=Admitted&classId=${encodeURIComponent(classId)}`
      );
      if (res.ok) {
        const admitted: (StudentOption & { status: string })[] = await res.json();
        setStudents(
          admitted.map((s) => ({
            studentId: s.id,
            student: {
              id: s.id,
              studentId: s.studentId,
              firstName: s.firstName,
              lastName: s.lastName,
              imageUrl: s.imageUrl,
            },
            status: "Present",
            note: "",
          }))
        );
      }
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadTakeModalContext(departmentId: string) {
    if (!departmentId) {
      setTakeClasses([]);
      setTakeContextCourses([]);
      setTakeContextSemesters([]);
      return;
    }
    setLoadingTakeContext(true);
    try {
      const res = await authFetch(
        `/api/departments/${departmentId}/attendance-context`
      );
      if (res.ok) {
        const data = await res.json();
        setTakeClasses(
          (data.classes ?? []).map(
            (c: ClassOption & Record<string, unknown>) => ({
              id: c.id,
              name: c.name,
              semester: c.semester,
              year: c.year,
              department: c.department,
            })
          )
        );
        setTakeContextCourses(data.courses ?? []);
        setTakeContextSemesters(data.semesters ?? []);
        setTakeForm((f) => ({
          ...f,
          semesterName: "",
          year: "",
          classId: "",
          courseId: "",
        }));
        setStudents([]);
      } else {
        setTakeClasses([]);
        setTakeContextCourses([]);
        setTakeContextSemesters([]);
      }
    } catch {
      setTakeClasses([]);
      setTakeContextCourses([]);
      setTakeContextSemesters([]);
    } finally {
      setLoadingTakeContext(false);
    }
  }

  function updateStudentStatus(studentId: number, status: string) {
    setStudents((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  }

  function markAll(status: string) {
    setStudents((prev) => prev.map((r) => ({ ...r, status })));
  }

  const semesterSelectOptions = useMemo(() => {
    if (takeContextSemesters.length > 0) {
      return [...takeContextSemesters]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ value: s.name, label: s.name }));
    }
    const names = [...new Set(takeClasses.map((c) => c.semester))].sort();
    return names.map((name) => ({ value: name, label: name }));
  }, [takeContextSemesters, takeClasses]);

  const yearOptions = useMemo(() => {
    const pool = takeForm.semesterName
      ? takeClasses.filter((c) => c.semester === takeForm.semesterName)
      : takeClasses;
    return [...new Set(pool.map((c) => c.year))].sort((a, b) => b - a);
  }, [takeClasses, takeForm.semesterName]);

  const filteredTakeClasses = useMemo(() => {
    return takeClasses.filter((c) => {
      if (takeForm.semesterName && c.semester !== takeForm.semesterName)
        return false;
      if (takeForm.year && String(c.year) !== takeForm.year) return false;
      return true;
    });
  }, [takeClasses, takeForm.semesterName, takeForm.year]);

  async function handleTakeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (
      !takeForm.departmentId ||
      !takeForm.semesterName ||
      !takeForm.year ||
      !takeForm.classId ||
      !takeForm.courseId ||
      students.length === 0
    ) {
      setSubmitError(
        "Select department, semester, year, class, and course, and ensure students are loaded."
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: Number(takeForm.classId),
          courseId: Number(takeForm.courseId),
          date: takeForm.date,
          shift: takeForm.shift,
          note: takeForm.note || undefined,
          records: students.map((r) => ({
            studentId: r.studentId,
            status: r.status,
            note: r.note || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to save attendance");
        return;
      }
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      <form onSubmit={handleTakeSubmit}>
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Take attendance
            </h2>
            <Link
              href="/attendance"
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              ← Back to sessions
            </Link>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {submitError && (
            <div className="mb-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
              {submitError}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Department <span className="text-error-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                required
                value={takeForm.departmentId}
                onChange={(e) => {
                  const v = e.target.value;
                  setTakeForm((f) => ({
                    ...f,
                    departmentId: v,
                    semesterName: "",
                    year: "",
                    classId: "",
                    courseId: "",
                  }));
                  void loadTakeModalContext(v);
                }}
                className="h-11 min-w-0 flex-1 appearance-none rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
              {loadingTakeContext && (
                <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              )}
            </div>
          </div>

          {takeForm.departmentId && takeContextCourses.length > 0 && (
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {takeContextCourses.length} active course(s) in this department — choose one in{" "}
              <strong>Course</strong> below.
            </p>
          )}

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Semester <span className="text-error-500">*</span>
              </label>
              <select
                required
                disabled={!takeForm.departmentId || loadingTakeContext}
                value={takeForm.semesterName}
                onChange={(e) => {
                  const v = e.target.value;
                  setTakeForm((f) => ({
                    ...f,
                    semesterName: v,
                    year: "",
                    classId: "",
                    courseId: "",
                  }));
                  setStudents([]);
                }}
                className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
              >
                <option value="">
                  {!takeForm.departmentId ? "Select department first" : "Select semester"}
                </option>
                {semesterSelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Academic year <span className="text-error-500">*</span>
              </label>
              <select
                required
                disabled={
                  !takeForm.departmentId || !takeForm.semesterName || loadingTakeContext
                }
                value={takeForm.year}
                onChange={(e) => {
                  const v = e.target.value;
                  setTakeForm((f) => ({
                    ...f,
                    year: v,
                    classId: "",
                    courseId: "",
                  }));
                  setStudents([]);
                }}
                className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
              >
                <option value="">
                  {!takeForm.semesterName
                    ? "Select semester first"
                    : yearOptions.length === 0
                      ? "No classes for this semester"
                      : "Select year"}
                </option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Class (active) <span className="text-error-500">*</span>
              </label>
              <select
                required
                disabled={
                  !takeForm.departmentId ||
                  !takeForm.semesterName ||
                  !takeForm.year ||
                  loadingTakeContext
                }
                value={takeForm.classId}
                onChange={(e) => {
                  const v = e.target.value;
                  setTakeForm((f) => ({ ...f, classId: v, courseId: "" }));
                  void loadStudentsForClass(v);
                }}
                className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
              >
                <option value="">
                  {!takeForm.departmentId
                    ? "Select department first"
                    : !takeForm.semesterName || !takeForm.year
                      ? "Select semester and year first"
                      : filteredTakeClasses.length === 0
                        ? "No active classes for this term"
                        : "Select class"}
                </option>
                {filteredTakeClasses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} · {c.semester} {c.year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Course <span className="text-error-500">*</span>
              </label>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                All active courses for the selected department.
              </p>
              <select
                required
                disabled={
                  !takeForm.departmentId ||
                  !takeForm.semesterName ||
                  !takeForm.year ||
                  !takeForm.classId ||
                  loadingTakeContext ||
                  departmentCoursesSorted.length === 0
                }
                value={takeForm.courseId}
                onChange={(e) =>
                  setTakeForm((f) => ({ ...f, courseId: e.target.value }))
                }
                className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
              >
                <option value="">
                  {!takeForm.classId
                    ? "Select class first"
                    : departmentCoursesSorted.length === 0
                      ? "No courses in this department"
                      : "Select course"}
                </option>
                {departmentCoursesSorted.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <DateInput
              id="take-attendance-date"
              label={
                <>
                  Date <span className="text-error-500">*</span>
                </>
              }
              labelClassName="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              value={takeForm.date}
              onChange={(v) => setTakeForm((f) => ({ ...f, date: v }))}
              required
              inputClassName="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            />
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Shift <span className="text-error-500">*</span>
              </label>
              <select
                required
                value={takeForm.shift}
                onChange={(e) =>
                  setTakeForm((f) => ({ ...f, shift: e.target.value }))
                }
                className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
              >
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Note
              </label>
              <input
                type="text"
                value={takeForm.note}
                onChange={(e) =>
                  setTakeForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="Optional note"
                className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
              />
            </div>
          </div>

          {students.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Mark all:
              </span>
              {ATTENDANCE_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => markAll(st)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    st === "Present"
                      ? "bg-success-50 text-success-600 hover:bg-success-100 dark:bg-success-500/10 dark:text-success-400"
                      : st === "Absent"
                        ? "bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/10 dark:text-error-400"
                        : st === "Late"
                          ? "bg-warning-50 text-warning-600 hover:bg-warning-100 dark:bg-warning-500/10 dark:text-warning-400"
                          : "bg-blue-light-50 text-blue-light-600 hover:bg-blue-light-100 dark:bg-blue-light-500/10 dark:text-blue-light-400"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[min(55vh,520px)] min-w-0 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            {loadingStudents ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                {takeForm.classId
                  ? "No admitted students found."
                  : "Select department, semester, year, and class to load students."}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-white/3">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Student
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      ID
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {students.map((r) => (
                    <tr
                      key={r.studentId}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/2"
                    >
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {r.student.studentId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {ATTENDANCE_STATUSES.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateStudentStatus(r.studentId, st)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                                r.status === st
                                  ? st === "Present"
                                    ? "bg-success-500 text-white shadow-sm"
                                    : st === "Absent"
                                      ? "bg-error-500 text-white shadow-sm"
                                      : st === "Late"
                                        ? "bg-warning-500 text-white shadow-sm"
                                        : "bg-blue-light-500 text-white shadow-sm"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                              }`}
                            >
                              {st.charAt(0)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {students.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Total: <strong>{students.length}</strong>
              </span>
              <span className="text-success-600 dark:text-success-400">
                Present: {students.filter((r) => r.status === "Present").length}
              </span>
              <span className="text-error-600 dark:text-error-400">
                Absent: {students.filter((r) => r.status === "Absent").length}
              </span>
              <span className="text-warning-600 dark:text-warning-400">
                Late: {students.filter((r) => r.status === "Late").length}
              </span>
              <span className="text-blue-light-600 dark:text-blue-light-400">
                Excused: {students.filter((r) => r.status === "Excused").length}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700 sm:px-6">
          <Link
            href="/attendance"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3 dark:hover:text-gray-300"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={
              submitting ||
              !canCreate ||
              students.length === 0 ||
              !takeForm.departmentId ||
              !takeForm.semesterName ||
              !takeForm.year ||
              !takeForm.courseId ||
              filteredTakeClasses.length === 0 ||
              departmentCoursesSorted.length === 0
            }
            size="sm"
          >
            {submitting ? "Saving..." : "Save attendance"}
          </Button>
        </div>
      </form>
    </div>
  );
}
