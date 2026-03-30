"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { DateInput } from "@/components/form/DateInput";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";

type Department = { id: number; name: string; code: string };
type ClassItem = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; name: string; code: string };
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
};
type Session = {
  id: number;
  class: { name: string; department: { code: string; name: string } };
  date: string;
  shift: string;
  takenBy: { name: string | null };
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export default function AttendanceReportPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [summary, setSummary] = useState({
    totalSessions: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    totalExcused: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"sessions" | "students">("sessions");
  const [studentAttendances, setStudentAttendances] = useState<StudentAttendance[]>([]);
  const [selectedClassInfo, setSelectedClassInfo] = useState<{ name: string; semester: string; year: number } | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDept) params.set("departmentId", filterDept);
      if (filterClass) params.set("classId", filterClass);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await authFetch(`/api/reports/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setSummary(data.summary || { totalSessions: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0, totalExcused: 0 });
      }
    } catch { /* empty */ }
    setLoading(false);
  }, [filterDept, filterClass, dateFrom, dateTo]);

  useEffect(() => {
    authFetch("/api/departments").then((r) => { if (r.ok) r.json().then((d: Department[]) => setDepartments(d)); });
    authFetch("/api/classes").then((r) => { if (r.ok) r.json().then((d: ClassItem[]) => setClasses(d)); });
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const fetchStudentAttendance = useCallback(async () => {
    if (!filterClass) {
      setStudentAttendances([]);
      setSelectedClassInfo(null);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`/api/reports/attendance-by-student?classId=${filterClass}`);
      if (res.ok) {
        const data = await res.json();
        setStudentAttendances(data.students || []);
        setSelectedClassInfo(data.class ? { name: data.class.name, semester: data.class.semester, year: data.class.year } : null);
      } else {
        setStudentAttendances([]);
        setSelectedClassInfo(null);
      }
    } catch {
      setStudentAttendances([]);
      setSelectedClassInfo(null);
    }
    setLoading(false);
  }, [filterClass]);

  useEffect(() => {
    if (viewMode === "students") fetchStudentAttendance();
  }, [viewMode, fetchStudentAttendance]);

  const filteredClasses = filterDept ? classes.filter((c) => c.department?.id === Number(filterDept)) : classes;

  const {
    paginatedItems: paginatedSessions,
    page: sessionsPage,
    setPage: setSessionsPage,
    pageSize: sessionsPageSize,
    setPageSize: setSessionsPageSize,
    totalPages: sessionsTotalPages,
    total: sessionsTotal,
    from: sessionsFrom,
    to: sessionsTo,
  } = usePagination(sessions, [filterDept, filterClass, dateFrom, dateTo]);
  const {
    paginatedItems: paginatedStudentAttendances,
    page: studentsPage,
    setPage: setStudentsPage,
    pageSize: studentsPageSize,
    setPageSize: setStudentsPageSize,
    totalPages: studentsTotalPages,
    total: studentsAttTotal,
    from: studentsFrom,
    to: studentsTo,
  } = usePagination(studentAttendances, [filterClass, studentAttendances]);

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Attendance Report" />
        <Button size="sm" onClick={handlePrint}>Print</Button>
      </div>

      <div className="mb-4 print:block hidden print:mb-2">
        <h1 className="text-xl font-bold text-gray-900">Attendance Report</h1>
        <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="no-print border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Filters</h3>
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
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
              <select
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setFilterClass("");
                }}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Class</label>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Classes</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department?.code} - {c.name} ({c.semester} {c.year})
                  </option>
                ))}
              </select>
            </div>
            <DateInput
              id="att-report-from"
              label="Date From"
              labelClassName="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
              value={dateFrom}
              onChange={setDateFrom}
              inputClassName="h-10 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
            />
            <DateInput
              id="att-report-to"
              label="Date To"
              labelClassName="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
              value={dateTo}
              onChange={setDateTo}
              inputClassName="h-10 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
            />
          </div>
        </div>

        {viewMode === "sessions" ? (
          <div className="flex flex-wrap gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="rounded-xl bg-brand-50 px-4 py-2 dark:bg-brand-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Sessions</span>
              <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{summary.totalSessions}</p>
            </div>
            <div className="rounded-xl bg-green-50 px-4 py-2 dark:bg-green-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Present</span>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{summary.totalPresent}</p>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-2 dark:bg-red-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Absent</span>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{summary.totalAbsent}</p>
            </div>
            <div className="rounded-xl bg-yellow-50 px-4 py-2 dark:bg-yellow-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Late</span>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-600">{summary.totalLate}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-2 dark:bg-white/5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Excused</span>
              <p className="text-xl font-bold text-gray-800 dark:text-white/90">{summary.totalExcused}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="rounded-xl bg-brand-50 px-4 py-2 dark:bg-brand-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">Class</span>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                {selectedClassInfo ? `${selectedClassInfo.name} (${selectedClassInfo.semester} ${selectedClassInfo.year})` : "Select a class"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-2 dark:bg-white/5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Students</span>
              <p className="text-xl font-bold text-gray-800 dark:text-white/90">{studentAttendances.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-2 dark:bg-white/5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Sessions</span>
              <p className="text-xl font-bold text-gray-800 dark:text-white/90">
                {studentAttendances[0]?.totalSessions ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 px-4 py-2 dark:bg-green-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">Avg Attendance %</span>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {studentAttendances.length > 0
                  ? (studentAttendances.reduce((s, a) => s + a.attendancePercent, 0) / studentAttendances.length).toFixed(1)
                  : "0"}%
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-2 dark:bg-white/5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Attendance = 10% of Exam</span>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Present + Excused / Total × 10</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {viewMode === "students" ? (
            filterClass ? (
              <>
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Student</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Present</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Absent</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Late</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Excused</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Attendance %</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Marks (0-10)</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-5 py-10 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                          <span className="text-sm text-gray-500">Loading...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : studentAttendances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-5 py-10 text-center text-sm text-gray-500">
                        No students in this class or no attendance sessions recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStudentAttendances.map((a) => (
                      <TableRow key={a.studentId} className="border-b border-gray-50 dark:border-gray-800">
                        <TableCell className="px-5 py-3">
                          <p className="font-medium text-gray-800 dark:text-white/90">{a.firstName} {a.lastName}</p>
                          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{a.studentIdStr}</p>
                        </TableCell>
                        <TableCell className="px-5 py-3 text-center font-medium text-green-600 dark:text-green-400">{a.present}</TableCell>
                        <TableCell className="px-5 py-3 text-center font-medium text-red-600 dark:text-red-400">{a.absent}</TableCell>
                        <TableCell className="px-5 py-3 text-center font-medium text-yellow-600 dark:text-yellow-600">{a.late}</TableCell>
                        <TableCell className="px-5 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{a.excused}</TableCell>
                        <TableCell className="px-5 py-3 text-center">
                          <span className={a.attendancePercent >= 80 ? "font-medium text-green-600 dark:text-green-400" : a.attendancePercent >= 60 ? "text-yellow-600 dark:text-yellow-500" : "font-medium text-red-600 dark:text-red-400"}>
                            {a.attendancePercent}%
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-3 text-center font-medium text-gray-800 dark:text-white/90">{a.attendanceMarks.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={studentsPage}
                totalPages={studentsTotalPages}
                total={studentsAttTotal}
                from={studentsFrom}
                to={studentsTo}
                pageSize={studentsPageSize}
                onPageChange={setStudentsPage}
                onPageSizeChange={setStudentsPageSize}
              />
              </>
            ) : (
              <div className="px-5 py-12 text-center text-sm text-gray-500">
                Select a class to view per-student attendance. Attendance marks (0-10) are used as 10% of the exam grade.
              </div>
            )
          ) : (
          <>
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-gray-800">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Class</TableCell>
                <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Date</TableCell>
                <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Shift</TableCell>
                <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Present</TableCell>
                <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Absent</TableCell>
                <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Late</TableCell>
                <TableCell isHeader className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Excused</TableCell>
                <TableCell isHeader className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Taken By</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-5 py-10 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                      <span className="text-sm text-gray-500">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-5 py-10 text-center text-sm text-gray-500">
                    No attendance sessions match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSessions.map((s) => (
                  <TableRow key={s.id} className="border-b border-gray-50 dark:border-gray-800">
                    <TableCell className="px-5 py-3">
                      <p className="font-medium text-gray-800 dark:text-white/90">{s.class?.department?.code} - {s.class?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.class?.department?.name}</p>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                      {new Date(s.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-center">
                      <Badge variant="light" color="info" size="sm">{s.shift}</Badge>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-center font-medium text-green-600 dark:text-green-400">{s.present}</TableCell>
                    <TableCell className="px-5 py-3 text-center font-medium text-red-600 dark:text-red-400">{s.absent}</TableCell>
                    <TableCell className="px-5 py-3 text-center font-medium text-yellow-600 dark:text-yellow-600">{s.late}</TableCell>
                    <TableCell className="px-5 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{s.excused}</TableCell>
                    <TableCell className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">{s.takenBy?.name ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            className="no-print"
            page={sessionsPage}
            totalPages={sessionsTotalPages}
            total={sessionsTotal}
            from={sessionsFrom}
            to={sessionsTo}
            pageSize={sessionsPageSize}
            onPageChange={setSessionsPage}
            onPageSizeChange={setSessionsPageSize}
          />
          </>
          )}
        </div>
      </div>
    </div>
  );
}
