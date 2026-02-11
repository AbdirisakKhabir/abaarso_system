"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";

type Department = { id: number; name: string; code: string };
type ClassItem = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course: { code: string; name: string; department: { id: number; name: string; code: string } };
};
type Session = {
  id: number;
  class: { name: string; course: { code: string; name: string; department: { code: string } } };
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

  const filteredClasses = filterDept ? classes.filter((c) => c.course?.department?.id === Number(filterDept)) : classes;

  return (
    <div>
      <PageBreadCrumb pageTitle="Attendance Report" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Filters</h3>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
              <select
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setFilterClass("");
                }}
                className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
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
                className="h-10 min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Classes</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course?.code} - {c.name} ({c.semester} {c.year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              />
            </div>
          </div>
        </div>

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

        <div className="overflow-x-auto">
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
                sessions.map((s) => (
                  <TableRow key={s.id} className="border-b border-gray-50 dark:border-gray-800">
                    <TableCell className="px-5 py-3">
                      <p className="font-medium text-gray-800 dark:text-white/90">{s.class?.course?.code} - {s.class?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.class?.course?.name}</p>
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
        </div>
      </div>
    </div>
  );
}
