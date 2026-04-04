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
import { globalRowIndex } from "@/hooks/usePagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { DownloadIcon, PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

type Department = { id: number; name: string; code: string };

type CourseRow = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  creditHours: number;
  departmentId: number;
  department: Department;
  isActive: boolean;
  classCount: number;
  createdAt: string;
};

export default function CoursesPage() {
  const { hasPermission } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDeptId, setFilterDeptId] = useState<string>("all");
  const [modal, setModal] = useState<"add" | "edit" | "import" | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDepartmentId, setImportDepartmentId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors?: string[] } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    creditHours: "3",
    departmentId: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
  } = useServerPagination([search, filterDeptId]);

  const canCreate = hasPermission("courses.create");
  const canEdit = hasPermission("courses.edit");
  const canDelete = hasPermission("courses.delete");

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("q", search.trim());
      if (filterDeptId !== "all") params.set("departmentId", filterDeptId);
      const res = await authFetch(`/api/courses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } else {
        setCourses([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterDeptId, setTotal]);

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

  useEffect(() => {
    void loadDepartments();
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  function openAdd() {
    setModal("add");
    setEditingId(null);
    setForm({
      name: "",
      code: "",
      description: "",
      creditHours: "3",
      departmentId: departments[0] ? String(departments[0].id) : "",
    });
    setSubmitError("");
  }

  function openEdit(c: CourseRow) {
    setModal("edit");
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      description: c.description ?? "",
      creditHours: String(c.creditHours),
      departmentId: String(c.departmentId),
    });
    setSubmitError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        creditHours: Number(form.creditHours),
        departmentId: Number(form.departmentId),
      };

      if (modal === "add") {
        const res = await authFetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to create course");
          return;
        }
      } else if (modal === "edit" && editingId) {
        const res = await authFetch(`/api/courses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to update course");
          return;
        }
      }
      await loadCourses();
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this course?")) return;
    const res = await authFetch(`/api/courses/${id}`, { method: "DELETE" });
    if (res.ok) await loadCourses();
    else {
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
    const deletable = courses.filter((c) => c.classCount === 0);
    if (selectedIds.size === deletable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletable.map((c) => c.id)));
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected course(s)? Courses with schedule slots will be skipped.`)) return;
    setBulkDeleting(true);
    try {
      const res = await authFetch("/api/courses/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedIds(new Set());
        await loadCourses();
        if (data.errors?.length) {
          alert(`Deleted ${data.deleted}. ${data.skipped} skipped:\n${data.errors.slice(0, 5).join("\n")}${data.errors.length > 5 ? `\n... and ${data.errors.length - 5} more` : ""}`);
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
      alert("Select a department first to delete all its courses.");
      return;
    }
    const deptName = departments.find((d) => String(d.id) === filterDeptId)?.name ?? "this department";
    if (!confirm(`Delete ALL courses in ${deptName}? Only courses without schedule slots will be deleted.`)) return;
    setBulkDeleting(true);
    try {
      const res = await authFetch("/api/courses/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: Number(filterDeptId) }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedIds(new Set());
        await loadCourses();
        if (data.errors?.length) {
          alert(`Deleted ${data.deleted}. ${data.skipped} skipped (have schedule slots).`);
        }
      } else {
        alert(data.error || "Bulk delete failed");
      }
    } catch {
      alert("Bulk delete failed");
    }
    setBulkDeleting(false);
  }

  function openImport() {
    setModal("import");
    setImportFile(null);
    setImportDepartmentId(departments[0] ? String(departments[0].id) : "");
    setImportResult(null);
  }

  async function handleDownloadTemplate() {
    try {
      const res = await authFetch("/api/courses/template");
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to download template");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Course_Import_Template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download template");
    }
  }

  async function handleImport() {
    if (!importFile || !importDepartmentId) {
      alert("Please select a department and an Excel file.");
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("departmentId", importDepartmentId);
      const res = await authFetch("/api/courses/import", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ created: data.created, errors: data.errors });
        if (data.created > 0) {
          await loadCourses();
        }
        if (!data.errors?.length && data.created > 0) {
          setModal(null);
          setImportFile(null);
        }
      } else {
        alert(data.error || "Import failed");
      }
    } catch {
      alert("Import failed");
    }
    setImportLoading(false);
  }

  const deletableOnPage = courses.filter((c) => c.classCount === 0);

  if (!hasPermission("courses.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Courses" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view courses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Courses" />
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
                Add Course
              </Button>
              <Button variant="outline" startIcon={<DownloadIcon />} onClick={openImport} size="sm">
                Import
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              All Courses
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {total}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {canDelete && deletableOnPage.length > 0 && (
              <div className="flex items-center gap-2">
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
            <select
              value={filterDeptId}
              onChange={(e) => setFilterDeptId(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="relative w-full sm:w-56">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2 pl-9 pr-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
              />
            </div>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search || filterDeptId !== "all"
                ? "No courses match your filters."
                : "No courses yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                {canDelete && deletableOnPage.length > 0 && (
                  <TableCell isHeader className="w-12 px-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === deletableOnPage.length &&
                        deletableOnPage.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                      aria-label="Select all"
                    />
                  </TableCell>
                )}
                <TableCell isHeader>#</TableCell>
                <TableCell isHeader>Course</TableCell>
                <TableCell isHeader>Code</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Credits</TableCell>
                <TableCell isHeader>Classes</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c, idx) => (
                <TableRow key={c.id}>
                  {canDelete && deletableOnPage.length > 0 && (
                    <TableCell className="w-12 px-3">
                      {c.classCount === 0 ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                          aria-label={`Select ${c.code}`}
                        />
                      ) : (
                        <span className="inline-block w-4" aria-hidden />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                    {globalRowIndex(page, pageSize, idx)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-50 text-xs font-bold text-warning-600 dark:bg-warning-500/10 dark:text-warning-400">
                        {c.code.substring(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white/90 truncate">
                          {c.name}
                        </p>
                        {c.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
                            {c.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge color="warning" size="sm">{c.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge color="info" size="sm">{c.department.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-50 px-2 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                      {c.creditHours}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      {c.classCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge color={c.isActive ? "success" : "error"} size="sm">
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={c.classCount > 0}
                          title={c.classCount > 0 ? "Remove schedule slots first" : "Delete course"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:hover:bg-error-500/10"
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

      {/* Import Modal */}
      {modal === "import" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Import Courses
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
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Download the template, fill in course data, then select the department and upload.
              </p>
              <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate} className="w-full sm:w-auto">
                Download Template
              </Button>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department <span className="text-error-500">*</span>
                </label>
                <select
                  required
                  value={importDepartmentId}
                  onChange={(e) => setImportDepartmentId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Excel File <span className="text-error-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 dark:border-gray-700 dark:file:bg-brand-500/20 dark:file:text-brand-400"
                />
              </div>
              {importResult && (
                <div className={`rounded-lg px-4 py-3 text-sm ${importResult.errors?.length ? "border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-500/10" : "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-500/10"}`}>
                  <p className={`font-medium ${importResult.errors?.length ? "text-amber-800 dark:text-amber-400" : "text-green-800 dark:text-green-400"}`}>
                    {importResult.errors?.length
                      ? `Imported ${importResult.created} course(s). ${importResult.errors.length} error(s).`
                      : `Imported ${importResult.created} course(s) successfully.`}
                  </p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-300">View errors</summary>
                      <ul className="mt-1 list-inside list-disc text-xs">
                        {importResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                        {importResult.errors.length > 5 && <li>... and {importResult.errors.length - 5} more</li>}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setModal(null); setImportFile(null); setImportResult(null); }} size="sm">
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importDepartmentId || !importFile || importLoading} size="sm">
                  {importLoading ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        </ModalOverlayGate>
      )}

      {/* Add/Edit Modal */}
      {modal && modal !== "import" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {modal === "add" ? "Add Course" : "Edit Course"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              <div className="space-y-4">
                {submitError && (
                  <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Course Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Introduction to Computer Science"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Code <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. CS101"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm font-mono uppercase text-gray-800 outline-none placeholder:text-gray-400 placeholder:font-sans placeholder:normal-case focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Credit Hours
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={form.creditHours}
                      onChange={(e) => setForm((f) => ({ ...f, creditHours: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Department <span className="text-error-500">*</span>
                  </label>
                  <select
                    required
                    value={form.departmentId}
                    onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of the course"
                    className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setModal(null)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? "Saving..." : modal === "add" ? "Create Course" : "Update Course"}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}
    </>
  );
}
