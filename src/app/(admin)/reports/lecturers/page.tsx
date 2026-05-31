"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";

type Department = { id: number; name: string; code: string };
type Course = { id: number; name: string; code: string; department?: Department };
type Lecturer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  degree: string | null;
  isActive: boolean;
  departments: Department[];
  courses: Course[];
};

export default function LecturersReportPage() {
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/lecturers");
      if (res.ok) setLecturers(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    authFetch("/api/departments").then((r) => {
      if (r.ok) r.json().then((d: Department[]) => setDepartments(d));
    });
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredLecturers = filterDept
    ? lecturers.filter((l) => l.departments?.some((d) => d.id === Number(filterDept)))
    : lecturers;

  const {
    paginatedItems: paginatedLecturers,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: lecturersTotal,
    from,
    to,
  } = usePagination(filteredLecturers, [filterDept]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Degree", "Departments", "Courses", "Status"];
    const rows = filteredLecturers.map((l) => [
      l.name,
      l.email,
      l.phone ?? "",
      l.degree ?? "",
      (l.departments ?? []).map((d) => d.code).join("; "),
      (l.courses ?? []).map((c) => c.code).join("; "),
      l.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lecturers_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasPermission("lecturers.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Lecturer Report" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to view this report.</p>
          <Link href="/reports" className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            ← Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Lecturer Report" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <div className="mb-4 print:block hidden print:mb-2">
        <h1 className="text-xl font-bold text-gray-900">Lecturer Report</h1>
        <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="no-print border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Filters</h3>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Lecturers: </span>
            <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{filteredLecturers.length}</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>#</TableCell>
                    <TableCell isHeader>Name</TableCell>
                    <TableCell isHeader>Email</TableCell>
                    <TableCell isHeader>Phone</TableCell>
                    <TableCell isHeader>Degree</TableCell>
                    <TableCell isHeader>Departments</TableCell>
                    <TableCell isHeader>Courses</TableCell>
                    <TableCell isHeader className="text-center">Status</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLecturers.map((l, idx) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-gray-500">{(page - 1) * pageSize + idx + 1}</TableCell>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell>{l.phone ?? "—"}</TableCell>
                      <TableCell>{l.degree ?? "—"}</TableCell>
                      <TableCell>
                        {(l.departments ?? []).length > 0
                          ? (l.departments ?? []).map((d) => d.code).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {(l.courses ?? []).length > 0
                          ? (l.courses ?? []).map((c) => c.code).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge color={l.isActive ? "success" : "error"} size="sm">
                          {l.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={page}
                totalPages={totalPages}
                total={lecturersTotal}
                from={from}
                to={to}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
