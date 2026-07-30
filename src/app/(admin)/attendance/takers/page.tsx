"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { globalRowIndex, usePagination } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  departmentId: number;
  department: { id: number; name: string; code: string };
};
type LecturerOption = { id: number; name: string; email: string };

type TakerRow = {
  id: number;
  classId: number;
  lecturerId: number;
  isActive: boolean;
  class: ClassOption;
  lecturer: LecturerOption;
  assignedBy: { id: number; name: string | null; email: string };
  createdAt: string;
};

type FormState = {
  lecturerId: string;
  classId: string;
  classIds: number[];
};

const emptyForm: FormState = {
  lecturerId: "",
  classId: "",
  classIds: [],
};

export default function AttendanceTakersPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<TakerRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [lecturers, setLecturers] = useState<LecturerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDepartmentId, setFilterDepartmentId] = useState("all");
  const [filterLecturerId, setFilterLecturerId] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalDepartmentId, setModalDepartmentId] = useState("all");
  const [modalLecturerSearch, setModalLecturerSearch] = useState("");
  const [modalClassSearch, setModalClassSearch] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission("attendance.assign.create");
  const canEdit = hasPermission("attendance.assign.edit");
  const canDelete = hasPermission("attendance.assign.delete");

  const loadRows = useCallback(async () => {
    const params = new URLSearchParams({ active: "false" });
    if (filterDepartmentId !== "all") {
      params.set("departmentId", filterDepartmentId);
    }
    if (filterLecturerId !== "all") {
      params.set("lecturerId", filterLecturerId);
    }
    const res = await authFetch(`/api/attendance-takers?${params.toString()}`);
    if (res.ok) setRows(await res.json());
    else setRows([]);
  }, [filterDepartmentId, filterLecturerId]);

  const loadOptions = useCallback(async () => {
    const [deptRes, classRes, lecturerRes] = await Promise.all([
      authFetch("/api/departments?active=true"),
      authFetch("/api/classes?active=true"),
      authFetch("/api/lecturers"),
    ]);

    if (deptRes.ok) {
      const data = await deptRes.json();
      setDepartments(
        data.map((d: DepartmentOption) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        }))
      );
    }

    if (classRes.ok) {
      const data = await classRes.json();
      setClasses(
        data.map((c: ClassOption & Record<string, unknown> & { department?: { id: number; name: string; code: string } }) => ({
          id: c.id,
          name: c.name,
          semester: c.semester,
          year: c.year,
          departmentId: c.departmentId ?? c.department?.id ?? 0,
          department: c.department,
        }))
      );
    }

    if (lecturerRes.ok) {
      const data = await lecturerRes.json();
      setLecturers(
        (Array.isArray(data) ? data : data.items ?? [])
          .filter((l: LecturerOption & { isActive?: boolean }) => l.isActive !== false)
          .map((l: LecturerOption) => ({
            id: l.id,
            name: l.name,
            email: l.email,
          }))
          .sort((a: LecturerOption, b: LecturerOption) =>
            a.name.localeCompare(b.name)
          )
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadOptions();
      setLoading(false);
    })();
  }, [loadOptions]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.lecturer.name,
        row.lecturer.email,
        row.class.name,
        row.class.department.code,
        row.class.department.name,
        row.class.semester,
        String(row.class.year),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, filterSearch]);

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: filteredTotal,
    from,
    to,
  } = usePagination(filtered, [filterDepartmentId, filterLecturerId, filterSearch]);

  const assignedClassIdsForLecturer = useMemo(() => {
    if (!form.lecturerId) return new Set<number>();
    return new Set(
      rows
        .filter((row) => String(row.lecturerId) === form.lecturerId && row.isActive)
        .map((row) => row.classId)
    );
  }, [rows, form.lecturerId]);

  const filteredLecturersForModal = useMemo(() => {
    const q = modalLecturerSearch.trim().toLowerCase();
    if (!q) return lecturers;
    return lecturers.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
    );
  }, [lecturers, modalLecturerSearch]);

  const availableClassesForAdd = useMemo(() => {
    const q = modalClassSearch.trim().toLowerCase();
    return classes.filter((c) => {
      if (assignedClassIdsForLecturer.has(c.id)) return false;
      if (modalDepartmentId !== "all" && c.departmentId !== Number(modalDepartmentId)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        c.name,
        c.semester,
        String(c.year),
        c.department?.code,
        c.department?.name,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [classes, assignedClassIdsForLecturer, modalDepartmentId, modalClassSearch]);

  const classesForEdit = useMemo(() => {
    const q = modalClassSearch.trim().toLowerCase();
    return classes.filter((c) => {
      if (modalDepartmentId !== "all" && c.departmentId !== Number(modalDepartmentId)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        c.name,
        c.semester,
        String(c.year),
        c.department?.code,
        c.department?.name,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [classes, modalDepartmentId, modalClassSearch]);

  function openAdd() {
    setModal("add");
    setEditingId(null);
    setForm(emptyForm);
    setModalDepartmentId("all");
    setModalLecturerSearch("");
    setModalClassSearch("");
    setSubmitError("");
    setSubmitInfo("");
  }

  function openEdit(row: TakerRow) {
    setModal("edit");
    setEditingId(row.id);
    setForm({
      lecturerId: String(row.lecturerId),
      classId: String(row.classId),
      classIds: [],
    });
    setModalDepartmentId(String(row.class.departmentId || row.class.department?.id || "all"));
    setModalLecturerSearch("");
    setModalClassSearch("");
    setSubmitError("");
    setSubmitInfo("");
  }

  function toggleClassSelection(classId: number) {
    setForm((current) => ({
      ...current,
      classIds: current.classIds.includes(classId)
        ? current.classIds.filter((id) => id !== classId)
        : [...current.classIds, classId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitInfo("");

    if (!form.lecturerId) {
      setSubmitError("Select a lecturer.");
      return;
    }

    if (modal === "edit") {
      if (!form.classId) {
        setSubmitError("Select a class.");
        return;
      }
    } else if (form.classIds.length === 0) {
      setSubmitError("Select at least one class.");
      return;
    }

    setSubmitting(true);
    try {
      const url =
        modal === "edit" && editingId
          ? `/api/attendance-takers/${editingId}`
          : "/api/attendance-takers";
      const method = modal === "edit" ? "PATCH" : "POST";
      const body =
        modal === "edit"
          ? {
              lecturerId: Number(form.lecturerId),
              classId: Number(form.classId),
            }
          : {
              lecturerId: Number(form.lecturerId),
              classIds: form.classIds,
            };

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to save assignment");
        return;
      }

      if (data.message) setSubmitInfo(data.message);
      await loadRows();
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this attendance taker assignment?")) return;
    const res = await authFetch(`/api/attendance-takers/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await loadRows();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  async function handleToggleActive(row: TakerRow) {
    const res = await authFetch(`/api/attendance-takers/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    if (res.ok) await loadRows();
    else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  }

  if (!hasPermission("attendance.assign.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Attendance Takers" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view attendance taker assignments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Attendance Takers" />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/attendance"
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3"
          >
            ← Attendance sessions
          </Link>
          {canCreate && (
            <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
              Assign lecturer
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/50 px-5 py-4 dark:border-brand-500/20 dark:bg-brand-500/5">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Assign a lecturer to one or more classes. Once assigned, the lecturer can take and edit
          attendance for any course and shift in those classes.
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Assignments
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search lecturer, class, department..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2 pl-9 pr-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:placeholder:text-gray-500"
              />
            </div>
            <select
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
              className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
            <select
              value={filterLecturerId}
              onChange={(e) => setFilterLecturerId(e.target.value)}
              className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="all">All lecturers</option>
              {lecturers.map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {filterSearch.trim() || filterDepartmentId !== "all" || filterLecturerId !== "all"
                ? "No assignments match your filters."
                : "No attendance taker assignments yet."}
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={openAdd}
                className="mt-3 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Assign a lecturer
              </button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent! hover:bg-transparent!">
                  <TableCell isHeader>#</TableCell>
                  <TableCell isHeader>Lecturer</TableCell>
                  <TableCell isHeader>Class</TableCell>
                  <TableCell isHeader>Status</TableCell>
                  <TableCell isHeader className="text-right">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                      {globalRowIndex(page, pageSize, idx)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white/90">
                          {row.lecturer.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {row.lecturer.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white/90">
                          {row.class.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {row.class.department.code} · {row.class.semester} {row.class.year}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleToggleActive(row)}
                        className="disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Badge color={row.isActive ? "success" : "light"} size="sm">
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                            aria-label="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
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
              total={filteredTotal}
              from={from}
              to={to}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {modal && (
        <ModalOverlayGate>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10 backdrop-blur-sm">
            <div className="w-full min-w-0 max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <form onSubmit={handleSubmit}>
                <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {modal === "add" ? "Assign lecturer to classes" : "Edit assignment"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {modal === "add"
                      ? "Choose one lecturer, then select one or more classes."
                      : "Update the lecturer or class for this assignment."}
                  </p>
                </div>
                <div className="space-y-4 px-6 py-5">
                  {submitError && (
                    <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                      {submitError}
                    </div>
                  )}
                  {submitInfo && (
                    <div className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
                      {submitInfo}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Lecturer <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="search"
                      value={modalLecturerSearch}
                      onChange={(e) => setModalLecturerSearch(e.target.value)}
                      placeholder="Search lecturer by name or email..."
                      className="mb-2 h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                    />
                    <select
                      required
                      value={form.lecturerId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({
                          ...f,
                          lecturerId: v,
                          classId: "",
                          classIds: [],
                        }));
                      }}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white"
                    >
                      <option value="">Select lecturer</option>
                      {filteredLecturersForModal.map((l) => (
                        <option key={l.id} value={String(l.id)}>
                          {l.name} ({l.email})
                        </option>
                      ))}
                    </select>
                    {modalLecturerSearch.trim() && filteredLecturersForModal.length === 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        No lecturers match your search.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Department
                      </label>
                      <select
                        value={modalDepartmentId}
                        onChange={(e) => {
                          setModalDepartmentId(e.target.value);
                          setForm((f) => ({
                            ...f,
                            classId: "",
                            classIds: [],
                          }));
                        }}
                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white"
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
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Search classes
                      </label>
                      <input
                        type="search"
                        value={modalClassSearch}
                        onChange={(e) => setModalClassSearch(e.target.value)}
                        placeholder="Class name, semester..."
                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  {modal === "edit" ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Class <span className="text-error-500">*</span>
                      </label>
                      <select
                        required
                        value={form.classId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, classId: e.target.value }))
                        }
                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white"
                      >
                        <option value="">Select class</option>
                        {classesForEdit.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name} · {c.semester} {c.year} ({c.department.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Classes <span className="text-error-500">*</span>
                        </label>
                        {form.lecturerId && availableClassesForAdd.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                classIds: availableClassesForAdd.map((c) => c.id),
                              }))
                            }
                            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Select all available
                          </button>
                        )}
                      </div>
                      {!form.lecturerId ? (
                        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          Select a lecturer first to choose classes.
                        </p>
                      ) : availableClassesForAdd.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          {modalDepartmentId !== "all" || modalClassSearch.trim()
                            ? "No classes match the selected department/search filters."
                            : "This lecturer is already assigned to all active classes."}
                        </p>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                          {availableClassesForAdd.map((c) => {
                            const checked = form.classIds.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
                                  checked
                                    ? "border-brand-300 bg-brand-50/70 dark:border-brand-500/40 dark:bg-brand-500/10"
                                    : "border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/3"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleClassSelection(c.id)}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                                    {c.name}
                                  </span>
                                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                                    {c.department.code} · {c.semester} {c.year}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {form.classIds.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {form.classIds.length} class{form.classIds.length === 1 ? "" : "es"} selected
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
                  >
                    {submitting
                      ? "Saving..."
                      : modal === "add"
                        ? `Assign${form.classIds.length > 0 ? ` (${form.classIds.length})` : ""}`
                        : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalOverlayGate>
      )}
    </>
  );
}
