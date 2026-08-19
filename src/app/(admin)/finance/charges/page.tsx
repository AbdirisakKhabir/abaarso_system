"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Download, FileText, RefreshCw, Search } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ChargeRow = {
  id: number;
  semester: string;
  year: number;
  amount: number;
  note: string | null;
  createdAt: string;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    department: { name: string; code: string };
    class: { name: string } | null;
  };
  chargedBy: { name: string; email: string } | null;
};

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type ClassOption = { id: number; name: string; department: { code: string } };

// ── Helpers ────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const selectCls =
  "h-9 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:text-white/80 dark:focus:border-brand-500/40";
const inputCls =
  "h-9 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:text-white/80 dark:focus:border-brand-500/40";

const PAGE_SIZE = 25;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChargeHistoryPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("finance.view") || hasPermission("admission.edit");

  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);

  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // load filter options
  useEffect(() => {
    authFetch("/api/semesters?active=true")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.semesters) ? data.semesters : [];
        setSemesters(list);
      })
      .catch(() => {});
    authFetch("/api/classes?pageSize=200")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setClassOptions(list);
      })
      .catch(() => {});
  }, []);

  const loadCharges = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("pageSize", String(PAGE_SIZE));
      if (filterSemester) params.set("semester", filterSemester);
      if (filterYear) params.set("year", filterYear);
      if (filterClassId) params.set("classId", filterClassId);
      if (debouncedQ) params.set("studentId", debouncedQ);
      const res = await authFetch(`/api/students/bulk-tuition-charge?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setCharges(Array.isArray(data.charges) ? data.charges : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, [filterSemester, filterYear, filterClassId, debouncedQ]);

  useEffect(() => { void loadCharges(1); }, [loadCharges]);

  // summary totals
  const pageTotal = charges.reduce((s, c) => s + c.amount, 0);

  const handleExportCSV = () => {
    const header = "ID,Student ID,Name,Department,Class,Semester,Year,Amount,Note,Charged By,Date";
    const rows = charges.map((c) =>
      [
        c.id,
        c.student.studentId,
        `"${c.student.firstName} ${c.student.lastName}"`,
        c.student.department.code,
        c.student.class?.name ?? "",
        c.semester,
        c.year,
        c.amount,
        `"${c.note ?? ""}"`,
        `"${c.chargedBy?.name ?? ""}"`,
        fmtDate(c.createdAt),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tuition-charges-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Charge History" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">
            You do not have permission to view charge history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Charge History" />

      <div className="space-y-5">
        {/* Header card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <FileText className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  Tuition Charge History
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  All semester-level tuition charges posted to student balances
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/finance/charge">
                <Button size="sm" variant="outline" startIcon={<FileText className="h-4 w-4" />}>
                  New Charge
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                startIcon={<Download className="h-4 w-4" />}
                onClick={handleExportCSV}
                disabled={charges.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Student ID"
                className={`${inputCls} w-44 pl-9`}
              />
            </div>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className={selectCls}
            >
              <option value="">All semesters</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className={selectCls}
            >
              <option value="">All years</option>
              {Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className={selectCls}
            >
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.department.code} — {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadCharges(page)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-6 px-5 py-3 text-sm text-gray-600 dark:text-gray-400">
            <span>
              <strong className="text-gray-900 dark:text-white">{total.toLocaleString()}</strong> total charges
            </span>
            <span>
              Page total:{" "}
              <strong className="text-gray-900 dark:text-white">${fmtAmt(pageTotal)}</strong>
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : charges.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                No charge records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>#</TableCell>
                    <TableCell isHeader>Student</TableCell>
                    <TableCell isHeader>Department</TableCell>
                    <TableCell isHeader>Class</TableCell>
                    <TableCell isHeader>Semester</TableCell>
                    <TableCell isHeader>Year</TableCell>
                    <TableCell isHeader className="text-right">Amount</TableCell>
                    <TableCell isHeader>Note</TableCell>
                    <TableCell isHeader>Charged by</TableCell>
                    <TableCell isHeader>Date</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs text-gray-400">{c.id}</TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {c.student.firstName} {c.student.lastName}
                        </p>
                        <p className="font-mono text-xs text-gray-500">{c.student.studentId}</p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {c.student.department.code}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {c.student.class?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{c.semester}</TableCell>
                      <TableCell className="text-sm">{c.year}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ${fmtAmt(c.amount)}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-xs text-gray-500 dark:text-gray-400">
                        {c.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                        {c.chargedBy?.name ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {fmtDate(c.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages} · {total.toLocaleString()} records
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => void loadCharges(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => void loadCharges(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
