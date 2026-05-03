"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
import { globalRowIndex } from "@/hooks/usePagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { buildTermSequence } from "@/lib/semester-term-sequence";
import { perSemesterTuition } from "@/lib/tuition-amount";
import {
  ArrowUpIcon,
  DollarLineIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
  UserCircleIcon,
} from "@/icons";

type Department = {
  id: number;
  name: string;
  code: string;
  tuitionFee?: number | null;
};

type ClassInfo = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course?: { code: string };
  department: { code: string };
  departmentId?: number;
};

type StudentRow = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  motherName: string | null;
  parentPhone: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  departmentId: number;
  department: Department;
  admissionAcademicYearId: number | null;
  admissionAcademicYear: { id: number; name: string } | null;
  classId: number | null;
  class: ClassInfo | null;
  program: string | null;
  admissionDate: string;
  status: string;
  paymentStatus: string;
  balance: number;
  createdAt: string;
};

const STATUSES = ["Pending", "Admitted", "Rejected", "Graduated"];

const STATUS_COLOR: Record<string, "warning" | "success" | "error" | "info" | "primary"> = {
  Pending: "warning",
  Admitted: "success",
  Rejected: "error",
  Graduated: "info",
};

const PAYMENT_STATUSES = ["Full Scholarship", "Half Scholar", "Fully Paid"] as const;

const PAYMENT_STATUS_COLOR: Record<string, "success" | "info" | "primary"> = {
  "Full Scholarship": "success",
  "Half Scholar": "info",
  "Fully Paid": "primary",
};

export default function AdmissionPage() {
  const { hasPermission } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDeptId, setFilterDeptId] = useState<string>("all");
  const [listSemesters, setListSemesters] = useState<{ id: number; name: string; sortOrder: number }[]>([]);
  const [filterListSemester, setFilterListSemester] = useState<string>("all");
  const [filterListYear, setFilterListYear] = useState<string>("all");
  const [filterListClassId, setFilterListClassId] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [modal, setModal] = useState<"import" | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDepartmentId, setImportDepartmentId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors?: string[] } | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [semestersForCharge, setSemestersForCharge] = useState<{ id: number; name: string; sortOrder: number }[]>(
    []
  );
  const [chargeSemesterCount, setChargeSemesterCount] = useState(1);
  const [chargeStartSemester, setChargeStartSemester] = useState("");
  const [chargeStartYear, setChargeStartYear] = useState(() => new Date().getFullYear());
  const [chargeSubmitting, setChargeSubmitting] = useState(false);
  const [chargeError, setChargeError] = useState("");
  /** Per-semester $ amount per internal student id (editable; charged × semester count and added to balance) */
  const [chargePerSemesterInputs, setChargePerSemesterInputs] = useState<Record<number, string>>({});

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    setTotal,
    totalPages,
    from,
    to,
  } = useServerPagination([
    search,
    filterStatus,
    filterDeptId,
    filterListSemester,
    filterListYear,
    filterListClassId,
  ]);

  const canCreate = hasPermission("admission.create");
  const canEdit = hasPermission("admission.edit");
  const canDelete = hasPermission("admission.delete");

  const refreshStatusStats = useCallback(async () => {
    const res = await authFetch("/api/students/stats");
    if (res.ok) setStatusCounts(await res.json());
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("q", search.trim());
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterDeptId !== "all") params.set("departmentId", filterDeptId);
      if (filterListClassId !== "all") {
        params.set("classId", filterListClassId);
      } else if (filterListSemester !== "all" && filterListYear !== "all") {
        params.set("classSemester", filterListSemester);
        params.set("classYear", filterListYear);
      }
      const res = await authFetch(`/api/students?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } else {
        setStudents([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    filterStatus,
    filterDeptId,
    filterListSemester,
    filterListYear,
    filterListClassId,
    setTotal,
  ]);

  async function loadDepartments() {
    const res = await authFetch("/api/departments");
    if (res.ok) {
      const data = await res.json();
      setDepartments(
        data.map((d: Department & Record<string, unknown>) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        }))
      );
    }
  }

  async function loadClasses() {
    const res = await authFetch("/api/classes");
    if (res.ok) {
      const data = await res.json();
      setClasses(
        data.map((c: { id: number; name: string; semester: string; year: number; department: { id: number; code: string } }) => ({
          id: c.id,
          name: c.name,
          semester: c.semester,
          year: c.year,
          department: { code: c.department?.code ?? "" },
          departmentId: c.department?.id ?? 0,
        }))
      );
    }
  }

  useEffect(() => {
    void refreshStatusStats();
  }, [refreshStatusStats]);

  useEffect(() => {
    void Promise.all([loadDepartments(), loadClasses(), authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) {
        r.json().then((d: { id: number; name: string; sortOrder?: number }[]) => {
          if (Array.isArray(d)) {
            setListSemesters(
              d.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder ?? 0 }))
            );
          }
        });
      }
    })]);
  }, []);

  const classYearOptions = useMemo(() => {
    const ys = new Set<number>();
    for (const c of classes) {
      if (typeof c.year === "number") ys.add(c.year);
    }
    const y = new Date().getFullYear();
    for (let i = y + 1; i >= y - 8; i--) ys.add(i);
    return [...ys].sort((a, b) => b - a);
  }, [classes]);

  const admissionFilteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (filterDeptId !== "all" && c.departmentId !== Number(filterDeptId)) return false;
      if (filterListSemester !== "all" && c.semester !== filterListSemester) return false;
      if (filterListYear !== "all" && c.year !== Number(filterListYear)) return false;
      return true;
    });
  }, [classes, filterDeptId, filterListSemester, filterListYear]);

  useEffect(() => {
    if (
      filterListClassId !== "all" &&
      !admissionFilteredClasses.some((c) => String(c.id) === filterListClassId)
    ) {
      setFilterListClassId("all");
    }
  }, [admissionFilteredClasses, filterListClassId]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const selectedStudentRows = useMemo(
    () => students.filter((s) => selectedIds.has(s.id)),
    [students, selectedIds]
  );

  const chargePreviewPeriods = useMemo(() => {
    if (!chargeStartSemester || semestersForCharge.length === 0) return [];
    const order = semestersForCharge.map((s) => s.name);
    try {
      return buildTermSequence(
        order,
        chargeStartSemester,
        chargeStartYear,
        chargeSemesterCount
      );
    } catch {
      return [];
    }
  }, [
    chargeStartSemester,
    chargeStartYear,
    chargeSemesterCount,
    semestersForCharge,
  ]);

  useEffect(() => {
    if (!chargeModalOpen || semestersForCharge.length === 0) return;
    setChargeStartSemester((prev) => {
      if (prev && semestersForCharge.some((s) => s.name === prev)) return prev;
      return semestersForCharge[0]?.name ?? "";
    });
  }, [chargeModalOpen, semestersForCharge]);

  async function handleDownloadTemplate() {
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await authFetch("/api/students/template");
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to download template");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Student_Import_Template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download template");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportExcel() {
    if (!importFile || !importDepartmentId) {
      alert("Please select a department and choose an Excel file.");
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("departmentId", importDepartmentId);
      const res = await authFetch("/api/students/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Import failed");
        return;
      }
      setImportResult({ created: data.created, errors: data.errors });
      setImportFile(null);
      await loadStudents();
      void refreshStatusStats();
    } catch {
      alert("Import failed");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this student record?")) return;
    const res = await authFetch(`/api/students/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadStudents();
      void refreshStatusStats();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  }

  async function ensureSemestersForChargeLoaded() {
    if (semestersForCharge.length > 0) return;
    const res = await authFetch("/api/semesters?active=true");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        setSemestersForCharge(
          data.map((r: { id: number; name: string; sortOrder?: number }) => ({
            id: r.id,
            name: r.name,
            sortOrder: r.sortOrder ?? 0,
          }))
        );
      }
    }
  }

  function seedChargePerSemesterInputs(rows: StudentRow[]) {
    const next: Record<number, string> = {};
    for (const s of rows) {
      const per = perSemesterTuition(
        s.department.tuitionFee ?? 0,
        s.paymentStatus
      );
      next[s.id] = String(per);
    }
    setChargePerSemesterInputs(next);
  }

  function effectivePerSemester(s: StudentRow): number {
    const raw = chargePerSemesterInputs[s.id];
    if (raw != null && String(raw).trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return perSemesterTuition(
      s.department.tuitionFee ?? 0,
      s.paymentStatus
    );
  }

  async function openChargeModal() {
    if (selectedIds.size === 0) return;
    setChargeError("");
    await ensureSemestersForChargeLoaded();
    const rows = students.filter((s) => selectedIds.has(s.id));
    seedChargePerSemesterInputs(rows);
    setChargeModalOpen(true);
  }

  function escapeHtml(text: string) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function printTuitionInvoice() {
    if (selectedStudentRows.length === 0) return;
    if (!chargeStartSemester || chargePreviewPeriods.length === 0) {
      alert("Choose a valid starting semester and number of semesters.");
      return;
    }
    const periodRows = chargePreviewPeriods
      .map((p) => `<li>${escapeHtml(p.semester)} ${p.year}</li>`)
      .join("");
    const bodyRows = selectedStudentRows
      .map((s) => {
        const per = effectivePerSemester(s);
        const line = per * chargeSemesterCount;
        return `<tr>
          <td>${escapeHtml(s.studentId)}</td>
          <td>${escapeHtml(`${s.firstName} ${s.lastName}`)}</td>
          <td>${escapeHtml(s.department.code)}</td>
          <td>${escapeHtml(s.paymentStatus || "Fully Paid")}</td>
          <td style="text-align:right">$${per.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align:right">$${line.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
      })
      .join("");
    const total = selectedStudentRows.reduce((sum, s) => {
      return sum + effectivePerSemester(s) * chargeSemesterCount;
    }, 0);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Tuition invoice</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 1.25rem; margin-bottom: 8px; }
        .meta { color: #444; font-size: 0.875rem; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .total { margin-top: 16px; font-weight: 700; }
      </style></head><body>
      <h1>Tuition assessment / invoice</h1>
      <p class="meta">Issued: ${new Date().toLocaleString()} · ${chargeSemesterCount} semester(s) · Per-student per-semester amount × count (edit amounts in the charge dialog as needed)</p>
      <p><strong>Periods covered:</strong></p>
      <ul>${periodRows}</ul>
      <table>
        <thead><tr><th>Student ID</th><th>Name</th><th>Dept</th><th>Payment status</th><th>Per semester</th><th>Line total</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p class="total">Grand total: $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </body></html>`);
    w.document.close();
    w.print();
    w.close();
  }

  async function handleApplyTuitionCharge() {
    if (selectedIds.size === 0) return;
    if (!chargeStartSemester || chargePreviewPeriods.length === 0) {
      setChargeError("Choose a valid starting semester and number of semesters.");
      return;
    }
    const ids = Array.from(selectedIds);
    setChargeSubmitting(true);
    setChargeError("");
    const perStudentPerSemester: Record<string, number> = {};
    for (const s of selectedStudentRows) {
      perStudentPerSemester[String(s.id)] = effectivePerSemester(s);
    }

    try {
      const res = await authFetch("/api/students/bulk-tuition-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: ids,
          semesterCount: chargeSemesterCount,
          startingSemester: chargeStartSemester,
          startingYear: chargeStartYear,
          perStudentPerSemester,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChargeError(data.error || "Failed to apply charge");
        return;
      }
      let msg = `Updated balance for ${data.charged} student(s).`;
      if (data.skipped?.length) {
        msg += ` Skipped ${data.skipped.length} (e.g. full scholarship or zero fee).`;
      }
      if (data.notFound?.length) {
        msg += ` ${data.notFound.length} id(s) not found.`;
      }
      alert(msg);
      setSelectedIds(new Set());
      setChargeModalOpen(false);
      await loadStudents();
      void refreshStatusStats();
    } catch {
      setChargeError("Request failed");
    } finally {
      setChargeSubmitting(false);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected student(s)?`)) return;
    setBulkDeleting(true);
    try {
      const res = await authFetch("/api/students/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedIds(new Set());
        await loadStudents();
        void refreshStatusStats();
        if (data.errors?.length) {
          alert(`Deleted ${data.deleted}. ${data.skipped} failed:\n${data.errors.slice(0, 5).join("\n")}${data.errors.length > 5 ? `\n... and ${data.errors.length - 5} more` : ""}`);
        }
      } else {
        alert(data.error || "Bulk delete failed");
      }
    } catch {
      alert("Bulk delete failed");
    }
    setBulkDeleting(false);
  }

  async function handleDeleteByDepartment() {
    if (filterDeptId === "all") {
      alert("Select a department first to delete all its students.");
      return;
    }
    const deptName = departments.find((d) => String(d.id) === filterDeptId)?.name ?? "this department";
    if (!confirm(`Delete ALL students in ${deptName}?`)) return;
    setBulkDeleting(true);
    try {
      const res = await authFetch("/api/students/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: Number(filterDeptId) }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedIds(new Set());
        await loadStudents();
        void refreshStatusStats();
        if (data.errors?.length) {
          alert(`Deleted ${data.deleted}. ${data.skipped} failed.`);
        }
      } else {
        alert(data.error || "Bulk delete failed");
      }
    } catch {
      alert("Bulk delete failed");
    }
    setBulkDeleting(false);
  }

  if (!hasPermission("admission.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Admission" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view admissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Admission" />
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <Button
                variant="outline"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                disabled={importLoading}
                size="sm"
              >
                Template
              </Button>
              <Button
                variant="outline"
                startIcon={<ArrowUpIcon />}
                onClick={() => {
                  setModal("import");
                  setImportResult(null);
                  setImportFile(null);
                  setImportDepartmentId(departments[0] ? String(departments[0].id) : "");
                }}
                size="sm"
              >
                Import Excel
              </Button>
              <Link href="/admission/new">
                <Button startIcon={<PlusIcon />} size="sm">
                  New Student
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATUSES.map((st) => {
          const count = statusCounts[st] ?? 0;
          return (
            <div
              key={st}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3"
            >
              <p className="text-2xl font-bold text-gray-800 dark:text-white/90">
                {count}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {st}
              </p>
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Admission list
              </h3>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                {total}
              </span>
              {(canEdit || canDelete) && total > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Select all applies to this page only.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
              {canEdit && total > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  startIcon={<DollarLineIcon />}
                  onClick={() => void openChargeModal()}
                  disabled={selectedIds.size === 0}
                >
                  Charge / Invoice ({selectedIds.size})
                </Button>
              )}
              {canDelete && total > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0 || bulkDeleting}
                    className="text-error-600 border-error-200 hover:bg-error-50 dark:border-error-800 dark:text-error-400 dark:hover:bg-error-500/10"
                  >
                    {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size} selected`}
                  </Button>
                  {filterDeptId !== "all" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteByDepartment}
                      disabled={bulkDeleting}
                      className="text-error-600 border-error-200 hover:bg-error-50 dark:border-error-800 dark:text-error-400 dark:hover:bg-error-500/10"
                    >
                      Delete all in department
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3 dark:border-gray-800 dark:bg-white/5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Filters
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
              <div className="relative w-full min-w-0 sm:w-56 sm:flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Search</label>
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Department</label>
                <select
                  value={filterDeptId}
                  onChange={(e) => {
                    setFilterDeptId(e.target.value);
                    setFilterListClassId("all");
                    setSelectedIds(new Set());
                  }}
                  className="h-10 w-full min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-brand-500/40 sm:w-auto"
                >
                  <option value="all">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-10 w-full min-w-[9rem] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-brand-500/40 sm:w-auto"
                >
                  <option value="all">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Class semester</label>
                <select
                  value={filterListSemester}
                  onChange={(e) => {
                    setFilterListSemester(e.target.value);
                    setFilterListClassId("all");
                  }}
                  className="h-10 w-full min-w-[8rem] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-brand-500/40 sm:w-auto"
                >
                  <option value="all">Any</option>
                  {listSemesters.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Class year</label>
                <select
                  value={filterListYear}
                  onChange={(e) => {
                    setFilterListYear(e.target.value);
                    setFilterListClassId("all");
                  }}
                  className="h-10 w-full min-w-[7rem] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-brand-500/40 sm:w-auto"
                >
                  <option value="all">Any</option>
                  {classYearOptions.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Class</label>
                <select
                  value={filterListClassId}
                  onChange={(e) => setFilterListClassId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-brand-500/40"
                >
                  <option value="all">All matching classes</option>
                  {admissionFilteredClasses.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.department.code} · {c.name} ({c.semester} {c.year})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Narrow the list by semester and year, then pick a specific class—or leave class on “All matching” to include every student assigned to a class in that term.
            </p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search ||
              filterStatus !== "all" ||
              filterDeptId !== "all" ||
              filterListSemester !== "all" ||
              filterListYear !== "all" ||
              filterListClassId !== "all"
                ? "No students match your filters."
                : "No students yet. Add a new student to get started."}
            </p>
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                {(canDelete || canEdit) && total > 0 && (
                  <TableCell isHeader className="w-12 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === students.length && students.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                      aria-label="Select all on this page"
                    />
                  </TableCell>
                )}
                <TableCell isHeader>#</TableCell>
                <TableCell isHeader>Student</TableCell>
                <TableCell isHeader>Student ID</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Adm. year</TableCell>
                <TableCell isHeader>Class</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader>Payment</TableCell>
                <TableCell isHeader className="text-right">Balance</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s, idx) => (
                <TableRow key={s.id}>
                  {(canDelete || canEdit) && total > 0 && (
                    <TableCell className="w-12 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                        aria-label={`Select ${s.studentId}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                    {globalRowIndex(page, pageSize, idx)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {s.imageUrl ? (
                        <Image
                          src={s.imageUrl}
                          alt={`${s.firstName} ${s.lastName}`}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                          {s.firstName.charAt(0)}{s.lastName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/students/${encodeURIComponent(s.studentId)}`}
                          className="font-semibold text-gray-800 hover:text-brand-600 hover:underline dark:text-white/90 dark:hover:text-brand-400"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.gender && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {s.gender}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/students/${encodeURIComponent(s.studentId)}`}
                      className="font-mono text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {s.studentId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge color="info" size="sm">{s.department.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    {s.admissionAcademicYear?.name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[140px] text-sm text-gray-700 dark:text-gray-300">
                    <span className="block truncate" title={s.class ? `${s.class.name} (${s.class.semester} ${s.class.year})` : undefined}>
                      {s.class ? `${s.class.name} (${s.class.semester} ${s.class.year})` : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_COLOR[s.status] || "light"} size="sm">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge color={PAYMENT_STATUS_COLOR[s.paymentStatus] || "light"} size="sm">
                      {s.paymentStatus || "Fully Paid"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-gray-800 dark:text-white/90">
                    ${(s.balance ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/students/${encodeURIComponent(s.studentId)}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                        aria-label="View Profile & ID Card"
                        title="View Profile & ID Card"
                      >
                        <UserCircleIcon className="h-4 w-4" />
                      </Link>
                      {canEdit && (
                        <Link
                          href={`/admission/${s.id}/edit`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                      )}
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
            total={total}
            from={from}
            to={to}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          </>
        )}
      </div>

      {/* Tuition charge / invoice (selected students) */}
      {chargeModalOpen && (
        <ModalOverlayGate>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Tuition charge &amp; invoice
                </h2>
                <button
                  type="button"
                  onClick={() => setChargeModalOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-6 py-5">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedStudentRows.length} student(s) selected. Set the first term and how many semesters to bill.
                  Default <strong>Per semester</strong> comes from the department fee and payment status (half scholar = 50%,
                  full scholarship = $0). You can type a different amount for any student; the{" "}
                  <strong>line total</strong> (per semester × semester count) is added to their balance.
                </p>
                {chargeError && (
                  <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                    {chargeError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Number of semesters
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={chargeSemesterCount}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setChargeSemesterCount(
                          Number.isFinite(n) ? Math.min(24, Math.max(1, n)) : 1
                        );
                      }}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First semester
                    </label>
                    <select
                      value={chargeStartSemester}
                      onChange={(e) => setChargeStartSemester(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
                    >
                      {semestersForCharge.length === 0 ? (
                        <option value="">Loading semesters…</option>
                      ) : (
                        semestersForCharge.map((sem) => (
                          <option key={sem.id} value={sem.name}>
                            {sem.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First year
                    </label>
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={chargeStartYear}
                      onChange={(e) => {
                        const y = parseInt(e.target.value, 10);
                        setChargeStartYear(Number.isFinite(y) ? y : new Date().getFullYear());
                      }}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    />
                  </div>
                </div>
                {chargePreviewPeriods.length > 0 && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Periods on invoice: </span>
                    {chargePreviewPeriods.map((p, i) => (
                      <span key={`${p.semester}-${p.year}-${i}`}>
                        {i > 0 ? " · " : ""}
                        {p.semester} {p.year}
                      </span>
                    ))}
                  </div>
                )}
                {chargeStartSemester && chargePreviewPeriods.length === 0 && semestersForCharge.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Could not build term list — check that the first semester matches an active semester in Settings.
                  </p>
                )}
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-white/5">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Student</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Dept</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">
                          Per semester ($)
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">
                          Balance charge ({chargeSemesterCount}×)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedStudentRows.map((s) => {
                        const per = effectivePerSemester(s);
                        const line = per * chargeSemesterCount;
                        return (
                          <tr key={s.id}>
                            <td className="px-3 py-2 text-gray-800 dark:text-white/90">
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.studentId}</span>
                              <br />
                              {s.firstName} {s.lastName}
                              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-500">
                                {s.paymentStatus}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{s.department.code}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={chargePerSemesterInputs[s.id] ?? ""}
                                onChange={(e) =>
                                  setChargePerSemesterInputs((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value,
                                  }))
                                }
                                className="h-9 w-full min-w-[6.5rem] rounded-lg border border-gray-200 bg-white px-2 text-right text-sm tabular-nums text-gray-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500/50"
                                aria-label={`Per semester tuition for ${s.firstName} ${s.lastName}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-800 dark:text-white/90">
                              ${line.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <Button variant="outline" size="sm" onClick={() => setChargeModalOpen(false)}>
                    Close
                  </Button>
                  <Button variant="outline" size="sm" startIcon={<DollarLineIcon />} onClick={printTuitionInvoice}>
                    Print invoice
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleApplyTuitionCharge()}
                    disabled={
                      chargeSubmitting ||
                      selectedStudentRows.length === 0 ||
                      chargePreviewPeriods.length === 0
                    }
                  >
                    {chargeSubmitting ? "Applying…" : "Charge selected (add to balance)"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ModalOverlayGate>
      )}

      {/* Import Modal */}
      {modal === "import" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Import Students from Excel
              </h2>
              <button
                type="button"
                onClick={() => { setModal(null); setImportFile(null); setImportResult(null); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a department, then upload an Excel file. The file should have a name column (Full Name, Name, or First Name + Last Name). Names are split by space: first word = First Name, rest = Last Name.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department
                </label>
                <select
                  value={importDepartmentId}
                  onChange={(e) => setImportDepartmentId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate} disabled={importLoading} size="sm">
                Download Template
              </Button>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Excel File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100 dark:file:bg-brand-500/10 dark:file:text-brand-400"
                />
              </div>
              {importResult && (
                <div className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
                  <p className="font-medium">Imported {importResult.created} student(s) successfully.</p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-error-600 dark:text-error-400">
                        {importResult.errors.length} error(s)
                      </summary>
                      <ul className="mt-1 list-inside list-disc text-error-600 dark:text-error-400">
                        {importResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>...and {importResult.errors.length - 10} more</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setModal(null); setImportFile(null); setImportResult(null); }} size="sm">
                  Close
                </Button>
                <Button
                  onClick={handleImportExcel}
                  disabled={!importDepartmentId || !importFile || importLoading}
                  size="sm"
                >
                  {importLoading ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        </ModalOverlayGate>
      )}
    </>
  );
}
