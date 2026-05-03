"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { authFetch } from "@/lib/api";
import { DownloadIcon } from "@/icons";
import { FinanceReportBar } from "@/components/reports/FinanceReportChart";

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; code: string; name: string };
};
type DepartmentOption = { id: number; name: string; code: string };
type PaidStudentRow = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department: { name: string; code: string; tuitionFee: number | null };
  paymentStatus?: string;
  amountPaid?: number;
  amountExpected?: number;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR + 1 - i);

export default function PaidStudentsReportPage() {
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [paidSemester, setPaidSemester] = useState("");
  const [paidYear, setPaidYear] = useState(String(CURRENT_YEAR));
  const [filterDeptId, setFilterDeptId] = useState<string>("all");
  const [paidClassId, setPaidClassId] = useState("");
  const [paidStudents, setPaidStudents] = useState<PaidStudentRow[]>([]);
  const [paidClassInfo, setPaidClassInfo] = useState<{
    name: string;
    semester: string;
    year: number;
    department: { code: string; name: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => {
        setSemesters(Array.isArray(d) ? d : []);
      });
    });
    authFetch("/api/classes").then((r) => {
      if (r.ok) r.json().then((d: ClassOption[]) => setClasses(Array.isArray(d) ? d : []));
    });
    authFetch("/api/departments").then((r) => {
      if (r.ok) r.json().then((d: DepartmentOption[]) => setDepartments(Array.isArray(d) ? d : []));
    });
  }, []);

  useEffect(() => {
    if (semesters.length > 0 && !paidSemester) setPaidSemester(semesters[0].name);
  }, [semesters, paidSemester]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (c.semester !== paidSemester || c.year !== Number(paidYear)) return false;
      if (filterDeptId !== "all" && c.department.id !== Number(filterDeptId)) return false;
      return true;
    });
  }, [classes, paidSemester, paidYear, filterDeptId]);

  useEffect(() => {
    if (paidClassId && !filteredClasses.some((c) => c.id === Number(paidClassId))) {
      setPaidClassId("");
    }
  }, [filteredClasses, paidClassId]);

  const handleGenerate = async () => {
    if (!paidSemester || !paidYear || !paidClassId) return;
    setLoading(true);
    setPaidClassInfo(null);
    setPaidStudents([]);
    try {
      const params = new URLSearchParams({
        semester: paidSemester,
        year: paidYear,
        classId: paidClassId,
      });
      const res = await authFetch(`/api/finance/paid-students?${params}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load paid students");
        return;
      }
      setPaidClassInfo(data.class);
      setPaidStudents(data.paidStudents || []);
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const {
    paginatedItems: paginatedPaidStudents,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: paidStudentsTotal,
    from,
    to,
  } = usePagination(paidStudents, [paidSemester, paidYear, paidClassId, filterDeptId, paidStudents]);

  const paidByDept = useMemo(() => {
    if (!paidStudents.length) return { categories: [] as string[], values: [] as number[] };
    const m = new Map<string, number>();
    for (const s of paidStudents) {
      const k = `${s.department.code} · ${s.department.name}`;
      m.set(k, (m.get(k) ?? 0) + (s.amountPaid ?? 0));
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { categories: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
  }, [paidStudents]);

  const totalCollected = paidStudents.reduce((s, t) => s + (t.amountPaid ?? 0), 0);

  const handleExportCSV = () => {
    if (paidStudents.length === 0) return;
    const headers = [
      "Student ID",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Department",
      "Payment Status",
      "Expected",
      "Paid",
    ];
    const rows = paidStudents.map((s) => [
      s.studentId,
      s.firstName,
      s.lastName,
      s.email || "",
      s.phone || "",
      `${s.department.code} - ${s.department.name}`,
      s.paymentStatus || "Fully Paid",
      s.amountExpected != null ? String(s.amountExpected) : "",
      s.amountPaid != null ? String(s.amountPaid) : "",
    ]);
    const totalExpected = paidStudents.reduce((s, t) => s + (t.amountExpected ?? 0), 0);
    const totalRow = [
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL",
      totalExpected.toFixed(2),
      totalCollected.toFixed(2),
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
      totalRow.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Paid_Students_${paidClassInfo?.department?.code || "class"}_${paidSemester}_${paidYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Paid Students Report" />
        {paidClassInfo && paidStudents.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button size="sm" onClick={handlePrint}>
              Print
            </Button>
          </div>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Paid Students by Semester &amp; Class
        </h3>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Select semester, year, and class to list students who have met tuition for that term
          (including full scholarship). Optionally narrow classes by department.
        </p>
        <div className="no-print mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Semester
            </label>
            <select
              value={paidSemester}
              onChange={(e) => setPaidSemester(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[120px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {semesters.length === 0 ? (
                <option value="">No semesters configured</option>
              ) : (
                semesters.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
            <select
              value={paidYear}
              onChange={(e) => setPaidYear(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[100px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Department
            </label>
            <select
              value={filterDeptId}
              onChange={(e) => {
                setFilterDeptId(e.target.value);
                setPaidClassId("");
              }}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
            <select
              value={paidClassId}
              onChange={(e) => setPaidClassId(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[220px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="">Select class</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department.code} - {c.name} ({c.semester} {c.year})
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={handleGenerate} disabled={!paidClassId || loading || semesters.length === 0}>
            {loading ? "Loading..." : "Generate List"}
          </Button>
        </div>

        {paidClassInfo && (
          <>
            <div className="mb-4 hidden print:mb-2 print:block">
              <h1 className="text-xl font-bold text-gray-900">Paid Students Report</h1>
              <p className="text-sm text-gray-600">
                {paidClassInfo.department.code} - {paidClassInfo.name} ({paidClassInfo.semester}{" "}
                {paidClassInfo.year})
              </p>
              <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
            </div>

            {paidStudents.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-white/5">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No students in this class are recorded as paid up for {paidClassInfo.semester}{" "}
                  {paidClassInfo.year} (or the class has no admitted students).
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {paidStudents.length} students · Total collected{" "}
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                    ${totalCollected.toLocaleString()}
                  </span>
                </p>
                {paidByDept.categories.length > 0 && (
                  <div className="no-print mb-6">
                    <FinanceReportBar
                      title="Amount collected by department"
                      categories={paidByDept.categories}
                      data={paidByDept.values}
                      color="#15803d"
                    />
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-transparent! hover:bg-transparent!">
                        <TableCell isHeader>Student ID</TableCell>
                        <TableCell isHeader>Name</TableCell>
                        <TableCell isHeader>Email</TableCell>
                        <TableCell isHeader>Phone</TableCell>
                        <TableCell isHeader>Department</TableCell>
                        <TableCell isHeader>Payment</TableCell>
                        <TableCell isHeader className="text-right">Expected</TableCell>
                        <TableCell isHeader className="text-right">Paid</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPaidStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <span className="no-print">
                              <Link
                                href={`/students/${encodeURIComponent(s.studentId)}`}
                                className="font-mono font-medium text-brand-600 hover:underline dark:text-brand-400"
                              >
                                {s.studentId}
                              </Link>
                            </span>
                            <span className="hidden font-mono font-medium text-gray-800 print:inline">
                              {s.studentId}
                            </span>
                          </TableCell>
                          <TableCell>
                            {s.firstName} {s.lastName}
                          </TableCell>
                          <TableCell>{s.email || "—"}</TableCell>
                          <TableCell>{s.phone || "—"}</TableCell>
                          <TableCell>
                            {s.department.code} - {s.department.name}
                          </TableCell>
                          <TableCell>{s.paymentStatus || "Fully Paid"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.amountExpected != null ? `$${Number(s.amountExpected).toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-green-600 dark:text-green-400">
                            {s.amountPaid != null ? `$${Number(s.amountPaid).toLocaleString()}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                        <TableCell colSpan={7} className="text-right">
                          Total collected
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                          ${totalCollected.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <TablePagination
                    className="no-print"
                    page={page}
                    totalPages={totalPages}
                    total={paidStudentsTotal}
                    from={from}
                    to={to}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
