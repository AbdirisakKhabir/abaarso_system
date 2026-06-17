"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { TRANSCRIPT_BRAND } from "@/lib/transcript-brand";

type Department = { id: number; name: string; code: string };
type ClassItem = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; name: string; code: string };
};
type CourseItem = {
  id: number;
  name: string;
  code: string;
  departmentId: number;
};
type StudentItem = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  classId: number | null;
  departmentId: number;
};
type StudentAttendance = {
  studentId: number;
  studentIdStr: string;
  firstName: string;
  lastName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalSessions: number;
  attendancePercent: number;
  attendanceMarks: number;
  rowDanger: boolean;
};
type Session = {
  id: number;
  class: { name: string; department: { code: string; name: string } };
  course: { id: number; code: string; name: string };
  date: string;
  shift: string;
  takenBy: { name: string | null };
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

function toDateInputValue(isoDate: string): string {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const selectClassName =
  "h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80";

export default function AttendanceReportPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [summary, setSummary] = useState({
    totalSessions: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    totalExcused: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterStudent, setFilterStudent] = useState("");
  const [dateMode, setDateMode] = useState<"all" | "single" | "range">("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [viewMode, setViewMode] = useState<"sessions" | "students">("students");
  const [studentAttendances, setStudentAttendances] = useState<StudentAttendance[]>([]);
  const [selectedClassInfo, setSelectedClassInfo] = useState<{
    name: string;
    semester: string;
    year: number;
    department?: { name: string; code: string };
  } | null>(null);


  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterDept) params.set("departmentId", filterDept);
    if (filterClass) params.set("classId", filterClass);
    if (filterCourse) params.set("courseId", filterCourse);
    if (filterStudent) params.set("studentId", filterStudent);
    if (dateMode === "single" && selectedDate) {
      params.set("dateFrom", selectedDate);
      params.set("dateTo", selectedDate);
    } else if (dateMode === "range") {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    }
    return params;
  }, [
    filterDept,
    filterClass,
    filterCourse,
    filterStudent,
    dateMode,
    selectedDate,
    dateFrom,
    dateTo,
  ]);

  const loadAvailableDates = useCallback(async () => {
    setLoadingDates(true);
    try {
      const params = new URLSearchParams();
      if (filterDept) params.set("departmentId", filterDept);
      if (filterClass) params.set("classId", filterClass);
      if (filterCourse) params.set("courseId", filterCourse);
      if (filterStudent) params.set("studentId", filterStudent);
      const res = await authFetch(`/api/reports/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const dates = [
          ...new Set<string>(
            (data.sessions || []).map((s: Session) => toDateInputValue(s.date))
          ),
        ].sort((a, b) => b.localeCompare(a));
        setAvailableDates(dates);
      } else {
        setAvailableDates([]);
      }
    } catch {
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [filterDept, filterClass, filterCourse, filterStudent]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/reports/attendance?${buildParams().toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setSummary(data.summary || { totalSessions: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0, totalExcused: 0 });
      }
    } catch { /* empty */ }
    setLoading(false);
  }, [buildParams]);

  const fetchStudentAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDept) params.set("departmentId", filterDept);
      if (filterClass) params.set("classId", filterClass);
      if (filterCourse) params.set("courseId", filterCourse);
      if (filterStudent) params.set("studentId", filterStudent);
      if (dateMode === "single" && selectedDate) {
        params.set("dateFrom", selectedDate);
        params.set("dateTo", selectedDate);
      } else if (dateMode === "range") {
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
      }
      const res = await authFetch(`/api/reports/attendance-by-student?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStudentAttendances(data.students || []);
        setSelectedClassInfo(
          data.class
            ? { name: data.class.name, semester: data.class.semester, year: data.class.year, department: data.class.department }
            : null
        );
      } else {
        setStudentAttendances([]);
        setSelectedClassInfo(null);
      }
    } catch {
      setStudentAttendances([]);
      setSelectedClassInfo(null);
    }
    setLoading(false);
  }, [
    filterDept,
    filterClass,
    filterCourse,
    filterStudent,
    dateMode,
    selectedDate,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    authFetch("/api/departments").then((r) => { if (r.ok) r.json().then((d: Department[]) => setDepartments(d)); });
    authFetch("/api/classes").then((r) => { if (r.ok) r.json().then((d: ClassItem[]) => setClasses(d)); });
    authFetch("/api/courses").then((r) => {
      if (r.ok) r.json().then((d: CourseItem[]) => setCourses(d));
    });
    authFetch("/api/students?status=Admitted").then((r) => {
      if (r.ok) r.json().then((d: StudentItem[]) => setStudents(d));
    });
  }, []);

  useEffect(() => {
    setDateMode("all");
    setSelectedDate("");
    setDateFrom("");
    setDateTo("");
  }, [filterDept, filterClass, filterCourse, filterStudent]);

  useEffect(() => {
    if (filterClass && !classes.some((c) => String(c.id) === filterClass)) {
      setFilterClass("");
    }
  }, [classes, filterClass]);

  useEffect(() => {
    if (filterCourse && !courses.some((c) => String(c.id) === filterCourse)) {
      setFilterCourse("");
    }
  }, [courses, filterCourse]);

  useEffect(() => {
    if (filterStudent && !students.some((s) => String(s.id) === filterStudent)) {
      setFilterStudent("");
    }
  }, [students, filterStudent]);

  useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) setDateTo(dateFrom);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (selectedDate && !availableDates.includes(selectedDate)) {
      setSelectedDate("");
    }
    if (dateFrom && !availableDates.includes(dateFrom)) {
      setDateFrom("");
    }
    if (dateTo && !availableDates.includes(dateTo)) {
      setDateTo("");
    }
  }, [availableDates, selectedDate, dateFrom, dateTo]);

  useEffect(() => { void loadAvailableDates(); }, [loadAvailableDates]);

  useEffect(() => {
    if (viewMode === "sessions") void fetchReport();
    else void fetchStudentAttendance();
  }, [viewMode, fetchReport, fetchStudentAttendance]);

  const filteredClasses = useMemo(
    () =>
      filterDept ? classes.filter((c) => c.department?.id === Number(filterDept)) : classes,
    [classes, filterDept]
  );

  const filteredCourses = useMemo(() => {
    if (filterClass) {
      const cls = classes.find((c) => String(c.id) === filterClass);
      if (!cls) return [];
      return courses.filter((c) => c.departmentId === cls.department.id);
    }
    if (filterDept) return courses.filter((c) => c.departmentId === Number(filterDept));
    return courses;
  }, [courses, classes, filterDept, filterClass]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterDept && s.departmentId !== Number(filterDept)) return false;
      if (filterClass && s.classId !== Number(filterClass)) return false;
      return true;
    });
  }, [students, filterDept, filterClass]);

  const selectedDept = departments.find((d) => String(d.id) === filterDept);
  const averageAttendancePercent =
    studentAttendances.length > 0
      ? studentAttendances.reduce((total, s) => total + safeNumber(s.attendancePercent), 0) /
        studentAttendances.length
      : 0;
  const averageAttendanceMarks =
    studentAttendances.length > 0
      ? studentAttendances.reduce((total, s) => total + safeNumber(s.attendanceMarks), 0) /
        studentAttendances.length
      : 0;

  const printTitle = viewMode === "students" ? "Student Attendance Report" : "Attendance Sessions Report";

  const dateRangeText =
    dateMode === "single" && selectedDate
      ? formatDateLabel(selectedDate)
      : dateMode === "range" && dateFrom && dateTo
      ? `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`
      : dateMode === "range" && dateFrom
        ? `From ${formatDateLabel(dateFrom)}`
        : dateMode === "range" && dateTo
          ? `Until ${formatDateLabel(dateTo)}`
          : "All dates";

  const handlePrint = () => window.print();

  // ── Print header (shown only on print) ─────────────────────────────────────
  const PrintHeader = () => (
    <div className="hidden print:block mb-4">
      <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-3 mb-3">
        <Image
          src={TRANSCRIPT_BRAND.logoUrl}
          alt={TRANSCRIPT_BRAND.universityName}
          width={64}
          height={64}
          className="h-16 w-16 object-contain"
        />
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-black tracking-wide uppercase">
            {TRANSCRIPT_BRAND.universityName}
          </p>
          <p className="text-sm font-semibold text-black">{TRANSCRIPT_BRAND.officeTitle}</p>
          <p className="text-xs text-black">{TRANSCRIPT_BRAND.website}</p>
        </div>
        <Image
          src={TRANSCRIPT_BRAND.logoUrl}
          alt={TRANSCRIPT_BRAND.universityName}
          width={64}
          height={64}
          className="h-16 w-16 object-contain"
        />
      </div>
      <div className="text-center mb-3">
        <p className="text-base font-bold uppercase tracking-widest text-black underline">
          {printTitle}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-black border border-gray-400 px-4 py-2 rounded">
        {selectedClassInfo && (
          <>
            <span><strong>Class:</strong> {selectedClassInfo.name}</span>
            <span><strong>Semester:</strong> {selectedClassInfo.semester} {selectedClassInfo.year}</span>
          </>
        )}
        {selectedDept && (
          <span><strong>Department:</strong> {selectedDept.code} — {selectedDept.name}</span>
        )}
        <span><strong>Date Range:</strong> {dateRangeText}</span>
        {viewMode === "students" && (
          <>
            <span><strong>Total Students:</strong> {studentAttendances.length}</span>
            <span><strong>Total Sessions:</strong> {studentAttendances[0]?.totalSessions ?? 0}</span>
            <span><strong>Avg Attendance %:</strong> {averageAttendancePercent.toFixed(1)}%</span>
            <span><strong>Avg Marks (10%):</strong> {averageAttendanceMarks.toFixed(2)}</span>
          </>
        )}
        {viewMode === "sessions" && (
          <>
            <span><strong>Total Sessions:</strong> {summary.totalSessions}</span>
            <span><strong>Total Present:</strong> {summary.totalPresent}</span>
            <span><strong>Total Absent:</strong> {summary.totalAbsent}</span>
            {summary.totalLate > 0 && <span><strong>Total Late:</strong> {summary.totalLate}</span>}
          </>
        )}
        <span><strong>Printed:</strong> {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Toolbar (hidden on print) ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Attendance Report" />
        <Button size="sm" onClick={handlePrint}>
          Print / Save PDF
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">

        {/* ── Filters panel (hidden on print) ── */}
        <div className="no-print border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Filters</h3>
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => setViewMode("sessions")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "sessions"
                    ? "bg-white text-brand-600 shadow dark:bg-gray-800 dark:text-brand-400"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                By Session
              </button>
              <button
                type="button"
                onClick={() => setViewMode("students")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "students"
                    ? "bg-white text-brand-600 shadow dark:bg-gray-800 dark:text-brand-400"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                By Student
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Department
              </label>
              <select
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setFilterClass("");
                  setFilterCourse("");
                  setFilterStudent("");
                }}
                className={selectClassName}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Class
              </label>
              <select
                value={filterClass}
                onChange={(e) => {
                  setFilterClass(e.target.value);
                  setFilterStudent("");
                }}
                className={`${selectClassName} disabled:opacity-50`}
              >
                <option value="">All classes</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.semester} {c.year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Course
              </label>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className={`${selectClassName} disabled:opacity-50`}
              >
                <option value="">All courses</option>
                {filteredCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Student
              </label>
              <select
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
                className={`${selectClassName} disabled:opacity-50`}
              >
                <option value="">All students</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentId} - {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Report date
              </label>
              <select
                value={dateMode}
                onChange={(e) => {
                  const mode = e.target.value as "all" | "single" | "range";
                  setDateMode(mode);
                  if (mode !== "single") setSelectedDate("");
                  if (mode !== "range") {
                    setDateFrom("");
                    setDateTo("");
                  }
                }}
                className={`${selectClassName} disabled:opacity-50`}
              >
                <option value="all">All dates</option>
                <option value="single">Single date</option>
                <option value="range">Date range</option>
              </select>
            </div>
            {dateMode === "single" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Select date
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  disabled={loadingDates}
                  className={`${selectClassName} disabled:opacity-50`}
                >
                  <option value="">Choose date</option>
                  {availableDates.map((d) => (
                    <option key={`single-${d}`} value={d}>
                      {formatDateLabel(d)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {dateMode === "range" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Date from
                  </label>
                  <select
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    disabled={loadingDates}
                    className={`${selectClassName} disabled:opacity-50`}
                  >
                    <option value="">Any date</option>
                    {availableDates.map((d) => (
                      <option key={`from-${d}`} value={d}>
                        {formatDateLabel(d)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Date to
                  </label>
                  <select
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    disabled={loadingDates}
                    className={`${selectClassName} disabled:opacity-50`}
                  >
                    <option value="">Any date</option>
                    {(dateFrom ? availableDates.filter((d) => d >= dateFrom) : availableDates).map((d) => (
                      <option key={`to-${d}`} value={d}>
                        {formatDateLabel(d)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          {loadingDates ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading available dates…</p>
          ) : availableDates.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              No attendance sessions found for the selected filters.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {availableDates.length} session date{availableDates.length === 1 ? "" : "s"} available — filter by department, class, course, student, and date.
            </p>
          )}
        </div>

        {/* ── Report body ── */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-gray-500">Loading…</span>
          </div>
        ) : (
          <div className="px-5 py-5 sm:px-6 attendance-report-print-area">
            <PrintHeader />

            {/* ── Screen info bar (hidden on print) ── */}
            <div className="no-print mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-white/3">
              {selectedClassInfo && (
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {selectedClassInfo.name} · {selectedClassInfo.semester} {selectedClassInfo.year}
                </span>
              )}
              <span className="text-gray-500 dark:text-gray-400">{dateRangeText}</span>
              {viewMode === "students" ? (
                <>
                  <span className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-800 dark:text-white/80">{studentAttendances.length}</strong> students
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-800 dark:text-white/80">{studentAttendances[0]?.totalSessions ?? 0}</strong> sessions
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-800 dark:text-white/80">{averageAttendancePercent.toFixed(1)}%</strong> avg attendance
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-800 dark:text-white/80">{averageAttendanceMarks.toFixed(2)}</strong> avg marks
                  </span>
                </>
              ) : (
                <>
                  <span className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-800 dark:text-white/80">{summary.totalSessions}</strong> sessions
                  </span>
                  <span className="text-green-700 dark:text-green-400">
                    <strong>{summary.totalPresent}</strong> present
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    <strong>{summary.totalAbsent}</strong> absent
                  </span>
                  {summary.totalLate > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      <strong>{summary.totalLate}</strong> late
                    </span>
                  )}
                  {summary.totalExcused > 0 && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <strong>{summary.totalExcused}</strong> excused
                    </span>
                  )}
                </>
              )}
            </div>

            {/* ── TABLE ── */}
            {viewMode === "students" ? (
              studentAttendances.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  No students or no attendance sessions in this date range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm print:text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-300 print:border-black bg-gray-50 print:bg-transparent">
                        <th className="py-2.5 pl-3 pr-2 text-left font-semibold text-gray-700 print:text-black w-8">#</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 print:text-black w-28">Student ID</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 print:text-black">Full Name</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Present</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Absent</th>
                        {studentAttendances.some((s) => s.late > 0) && (
                          <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-16">Late</th>
                        )}
                        {studentAttendances.some((s) => s.excused > 0) && (
                          <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Excused</th>
                        )}
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Sessions</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-24">Attendance %</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentAttendances.map((s, idx) => (
                        <tr
                          key={s.studentId}
                          className={`border-b border-gray-100 print:border-gray-300 ${
                            idx % 2 === 1 ? "bg-gray-50/60 print:bg-transparent" : ""
                          } ${s.rowDanger ? "bg-red-50/40 print:bg-transparent" : ""}`}
                        >
                          <td className="py-2 pl-3 pr-2 text-gray-400 print:text-black text-xs">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600 print:text-black">{s.studentIdStr}</td>
                          <td className="py-2 px-3 font-medium text-gray-800 print:text-black">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-green-700 print:text-black">{s.present}</td>
                          <td className={`py-2 px-3 text-center font-semibold print:text-black ${s.absent > 0 ? "text-red-600" : "text-gray-500"}`}>
                            {s.absent}
                          </td>
                          {studentAttendances.some((r) => r.late > 0) && (
                            <td className="py-2 px-3 text-center text-gray-700 print:text-black">{s.late}</td>
                          )}
                          {studentAttendances.some((r) => r.excused > 0) && (
                            <td className="py-2 px-3 text-center text-gray-600 print:text-black">{s.excused}</td>
                          )}
                          <td className="py-2 px-3 text-center text-gray-600 print:text-black">{s.totalSessions}</td>
                          <td className="py-2 px-3 text-center text-gray-700 print:text-black">
                            {safeNumber(s.attendancePercent).toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-center text-gray-700 print:text-black">
                            {safeNumber(s.attendanceMarks).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 print:border-black font-semibold bg-gray-50 print:bg-transparent">
                        <td className="py-2 pl-3 pr-2" />
                        <td className="py-2 px-3 text-xs text-gray-500 print:text-black">Total</td>
                        <td className="py-2 px-3 text-gray-700 print:text-black">
                          {studentAttendances.length} student{studentAttendances.length === 1 ? "" : "s"}
                        </td>
                        <td className="py-2 px-3 text-center text-green-700 print:text-black">
                          {studentAttendances.reduce((acc, s) => acc + s.present, 0)}
                        </td>
                        <td className="py-2 px-3 text-center text-red-600 print:text-black">
                          {studentAttendances.reduce((acc, s) => acc + s.absent, 0)}
                        </td>
                        {studentAttendances.some((s) => s.late > 0) && (
                          <td className="py-2 px-3 text-center text-gray-700 print:text-black">
                            {studentAttendances.reduce((acc, s) => acc + s.late, 0)}
                          </td>
                        )}
                        {studentAttendances.some((s) => s.excused > 0) && (
                          <td className="py-2 px-3 text-center text-gray-600 print:text-black">
                            {studentAttendances.reduce((acc, s) => acc + s.excused, 0)}
                          </td>
                        )}
                        <td className="py-2 px-3 text-center text-gray-700 print:text-black">
                          {studentAttendances[0]?.totalSessions ?? 0}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-700 print:text-black">
                          {averageAttendancePercent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-center text-gray-700 print:text-black">
                          {averageAttendanceMarks.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            ) : (
              sessions.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  No attendance sessions match the selected filters.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm print:text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-300 print:border-black bg-gray-50 print:bg-transparent">
                        <th className="py-2.5 pl-3 pr-2 text-left font-semibold text-gray-700 print:text-black w-8">#</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 print:text-black">Course</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 print:text-black w-32">Date</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 print:text-black w-24">Shift</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Present</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Absent</th>
                        {sessions.some((s) => s.late > 0) && (
                          <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-16">Late</th>
                        )}
                        {sessions.some((s) => s.excused > 0) && (
                          <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-20">Excused</th>
                        )}
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-700 print:text-black w-16">Total</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 print:text-black w-32">Taken By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, idx) => (
                        <tr
                          key={s.id}
                          className={`border-b border-gray-100 print:border-gray-300 ${
                            idx % 2 === 1 ? "bg-gray-50/60 print:bg-transparent" : ""
                          }`}
                        >
                          <td className="py-2 pl-3 pr-2 text-gray-400 print:text-black text-xs">{idx + 1}</td>
                          <td className="py-2 px-3 print:text-black">
                            <p className="font-medium text-gray-800 print:text-black">{s.course?.code}</p>
                            <p className="text-xs text-gray-500 print:text-black">{s.course?.name}</p>
                          </td>
                          <td className="py-2 px-3 text-gray-700 print:text-black whitespace-nowrap">
                            {formatDateShort(s.date)}
                          </td>
                          <td className="py-2 px-3 print:text-black">
                            <span className="no-print">
                              <Badge variant="light" color={s.shift === "Morning" ? "info" : s.shift === "Afternoon" ? "warning" : "primary"} size="sm">
                                {s.shift}
                              </Badge>
                            </span>
                            <span className="hidden print:inline text-black">{s.shift}</span>
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-green-700 print:text-black">{s.present}</td>
                          <td className={`py-2 px-3 text-center font-semibold print:text-black ${s.absent > 0 ? "text-red-600" : "text-gray-500"}`}>
                            {s.absent}
                          </td>
                          {sessions.some((r) => r.late > 0) && (
                            <td className="py-2 px-3 text-center text-gray-700 print:text-black">{s.late}</td>
                          )}
                          {sessions.some((r) => r.excused > 0) && (
                            <td className="py-2 px-3 text-center text-gray-600 print:text-black">{s.excused}</td>
                          )}
                          <td className="py-2 px-3 text-center text-gray-600 print:text-black">{s.total}</td>
                          <td className="py-2 px-3 text-sm text-gray-600 print:text-black">{s.takenBy?.name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 print:border-black font-semibold bg-gray-50 print:bg-transparent">
                        <td className="py-2 pl-3 pr-2" />
                        <td className="py-2 px-3 text-xs text-gray-500 print:text-black" colSpan={3}>
                          Totals — {summary.totalSessions} session{summary.totalSessions === 1 ? "" : "s"}
                        </td>
                        <td className="py-2 px-3 text-center text-green-700 print:text-black">{summary.totalPresent}</td>
                        <td className="py-2 px-3 text-center text-red-600 print:text-black">{summary.totalAbsent}</td>
                        {sessions.some((s) => s.late > 0) && (
                          <td className="py-2 px-3 text-center text-gray-700 print:text-black">{summary.totalLate}</td>
                        )}
                        {sessions.some((s) => s.excused > 0) && (
                          <td className="py-2 px-3 text-center text-gray-600 print:text-black">{summary.totalExcused}</td>
                        )}
                        <td className="py-2 px-3 text-center text-gray-700 print:text-black">{summary.totalPresent + summary.totalAbsent + summary.totalLate + summary.totalExcused}</td>
                        <td className="py-2 px-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}

            {/* ── Print footer ── */}
            <div className="hidden print:block mt-6 border-t border-gray-300 pt-3 text-xs text-black">
              <div className="flex justify-between">
                <span>Abaarso Tech University — Attendance Report</span>
                <span>Generated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
