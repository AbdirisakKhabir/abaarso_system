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
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

type DepartmentOption = { id: number; name: string; code: string };

type ClassRow = {
  id: number;
  name: string;
  departmentId: number;
  department: { id: number; name: string; code: string };
  semester: string;
  year: number;
  room: string | null;
  schedule: string | null;
  capacity: number;
  isActive: boolean;
  createdAt: string;
};

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type AcademicYearOption = { id: number; startYear: number; endYear: number; name: string; isActive?: boolean };

export default function ClassesPage() {
  const { hasPermission } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    semester: "Fall",
    academicYearId: "",
    room: "",
    schedule: "",
    capacity: "40",
  });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
  } = useServerPagination([search, filterSemester]);

  const canCreate = hasPermission("classes.create");
  const canEdit = hasPermission("classes.edit");
  const canDelete = hasPermission("classes.delete");

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("q", search.trim());
      if (filterSemester !== "all") params.set("semester", filterSemester);
      const res = await authFetch(`/api/classes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClasses(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } else {
        setClasses([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterSemester, setTotal]);

  async function loadDepartments() {
    const res = await authFetch("/api/departments");
    if (res.ok) setDepartments(await res.json());
  }

  async function loadAcademicYears() {
    const res = await authFetch("/api/academic-years");
    if (res.ok) setAcademicYears(await res.json());
  }

  useEffect(() => {
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => setSemesters(d));
    });
  }, []);

  useEffect(() => {
    void Promise.all([loadDepartments(), loadAcademicYears()]);
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  function openAdd() {
    setModal("add");
    setEditingId(null);
    const defaultYear = academicYears.find((y) => y.isActive) ?? academicYears[academicYears.length - 1];
    setForm({
      name: "",
      departmentId: departments[0] ? String(departments[0].id) : "",
      semester: semesters[0]?.name ?? "Fall",
      academicYearId: defaultYear ? String(defaultYear.id) : "",
      room: "",
      schedule: "",
      capacity: "40",
    });
    setSubmitError("");
  }

  function openEdit(c: ClassRow) {
    setModal("edit");
    setEditingId(c.id);
    const ay = academicYears.find((y) => y.startYear <= c.year && c.year <= y.endYear);
    setForm({
      name: c.name,
      departmentId: String(c.departmentId),
      semester: c.semester,
      academicYearId: ay ? String(ay.id) : "",
      room: c.room ?? "",
      schedule: c.schedule ?? "",
      capacity: String(c.capacity),
    });
    setSubmitError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    const ay = academicYears.find((y) => String(y.id) === form.academicYearId);
    const year = ay ? (form.semester === "Fall" ? ay.startYear : ay.endYear) : new Date().getFullYear();
    try {
      const payload = {
        name: form.name,
        departmentId: Number(form.departmentId),
        semester: form.semester,
        year,
        room: form.room || undefined,
        schedule: form.schedule || undefined,
        capacity: Number(form.capacity),
      };

      if (modal === "add") {
        const res = await authFetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to create class");
          return;
        }
      } else if (modal === "edit" && editingId) {
        const res = await authFetch(`/api/classes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to update class");
          return;
        }
      }
      await loadClasses();
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this class?")) return;
    const res = await authFetch(`/api/classes/${id}`, { method: "DELETE" });
    if (res.ok) await loadClasses();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  if (!hasPermission("classes.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Classes" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view classes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Classes" />
        {canCreate && (
          <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
            Add Class
          </Button>
        )}
      </div>

      {/* Card */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              All Classes
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {total}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
            >
              <option value="all">All Semesters</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <div className="relative w-full sm:w-56">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search classes..."
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search || filterSemester !== "all"
                ? "No classes match your filters."
                : "No classes yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>#</TableCell>
                <TableCell isHeader>Class</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Semester</TableCell>
                <TableCell isHeader>Room</TableCell>
                <TableCell isHeader>Schedule</TableCell>
                <TableCell isHeader>Capacity</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((c, idx) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                    {globalRowIndex(page, pageSize, idx)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success-50 text-xs font-bold text-success-600 dark:bg-success-500/10 dark:text-success-400">
                        {c.name.substring(0, 2)}
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-white/90">
                        {c.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge color="info" size="sm">{c.department.code}</Badge>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
                      {c.department.name}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        color={
                          c.semester === "Fall"
                            ? "error"
                            : c.semester === "Spring"
                              ? "success"
                              : "warning"
                        }
                        size="sm"
                      >
                        {c.semester}
                      </Badge>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {c.year}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                    {c.room || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                    {c.schedule || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      {c.capacity}
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

      {/* Modal */}
      {modal && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {modal === "add" ? "Add Class" : "Edit Class"}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Class Name <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Level 1-A"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                    />
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
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Semester <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      value={form.semester}
                      onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                      className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    >
                      {semesters.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Academic Year <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      value={form.academicYearId}
                      onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}
                      className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    >
                      <option value="">Select academic year</option>
                      {academicYears.map((ay) => (
                        <option key={ay.id} value={String(ay.id)}>
                          {ay.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.capacity}
                      onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Room
                    </label>
                    <input
                      type="text"
                      value={form.room}
                      onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                      placeholder="e.g. Room 201"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Schedule
                    </label>
                    <input
                      type="text"
                      value={form.schedule}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                      placeholder="e.g. Mon/Wed 9:00-10:30"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setModal(null)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? "Saving..." : modal === "add" ? "Create Class" : "Update Class"}
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
