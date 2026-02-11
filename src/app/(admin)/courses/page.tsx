"use client";

import React, { useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

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
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
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

  const canCreate = hasPermission("courses.create");
  const canEdit = hasPermission("courses.edit");
  const canDelete = hasPermission("courses.delete");

  async function loadCourses() {
    const res = await authFetch("/api/courses");
    if (res.ok) setCourses(await res.json());
  }

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
    (async () => {
      setLoading(true);
      await Promise.all([loadCourses(), loadDepartments()]);
      setLoading(false);
    })();
  }, []);

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

  const filtered = courses.filter((c) => {
    if (filterDeptId !== "all" && String(c.departmentId) !== filterDeptId)
      return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.department.name.toLowerCase().includes(q)
    );
  });

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
        {canCreate && (
          <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
            Add Course
          </Button>
        )}
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              All Courses
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
        ) : filtered.length === 0 ? (
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
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
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
              {filtered.map((c, idx) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                    {idx + 1}
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
                      {canDelete && c.classCount === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
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
        )}
      </div>

      {/* Modal */}
      {modal && (
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
      )}
    </>
  );
}
