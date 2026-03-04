"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
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
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

type DeptInfo = { id: number; name: string; code: string };
type CourseInfo = { id: number; name: string; code: string; department: DeptInfo };

type LecturerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  degree: string | null;
  imageUrl: string | null;
  cvUrl: string | null;
  isActive: boolean;
  departments: DeptInfo[];
  courses: CourseInfo[];
  createdAt: string;
};

export default function LecturersPage() {
  const { hasPermission } = useAuth();
  const [lecturers, setLecturers] = useState<LecturerRow[]>([]);
  const [departments, setDepartments] = useState<DeptInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    degree: "",
    departmentIds: [] as number[],
    courseIds: [] as number[],
    imageUrl: "",
    imagePublicId: "",
    cvUrl: "",
    cvPublicId: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission("lecturers.create");
  const canEdit = hasPermission("lecturers.edit");
  const canDelete = hasPermission("lecturers.delete");

  async function loadLecturers() {
    const res = await authFetch("/api/lecturers");
    if (res.ok) setLecturers(await res.json());
  }

  async function loadDepartments() {
    const res = await authFetch("/api/departments");
    if (res.ok) {
      const data = await res.json();
      setDepartments(data.map((d: DeptInfo & { faculty?: unknown }) => ({ id: d.id, name: d.name, code: d.code })));
    }
  }

  async function loadCourses() {
    const res = await authFetch("/api/courses");
    if (res.ok) {
      const data = await res.json();
      setCourses(data.map((c: CourseInfo & { department?: DeptInfo }) => ({ id: c.id, name: c.name, code: c.code, department: c.department ?? { id: 0, name: "", code: "" } })));
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadLecturers(), loadDepartments(), loadCourses()]);
      setLoading(false);
    })();
  }, []);

  function openAdd() {
    setModal("add");
    setEditingId(null);
    setForm({ name: "", email: "", phone: "", degree: "", departmentIds: [], courseIds: [], imageUrl: "", imagePublicId: "", cvUrl: "", cvPublicId: "" });
    setImagePreview(null);
    setSubmitError("");
  }

  function openEdit(l: LecturerRow) {
    setModal("edit");
    setEditingId(l.id);
    setForm({
      name: l.name,
      email: l.email,
      phone: l.phone ?? "",
      degree: l.degree ?? "",
      departmentIds: (l.departments ?? []).map((d) => d.id),
      courseIds: (l.courses ?? []).map((c) => c.id),
      imageUrl: (l as LecturerRow & { imageUrl?: string }).imageUrl ?? "",
      imagePublicId: (l as LecturerRow & { imagePublicId?: string }).imagePublicId ?? "",
      cvUrl: (l as LecturerRow & { cvUrl?: string }).cvUrl ?? "",
      cvPublicId: (l as LecturerRow & { cvPublicId?: string }).cvPublicId ?? "",
    });
    setImagePreview((l as LecturerRow & { imageUrl?: string }).imageUrl ?? null);
    setSubmitError("");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "university/lecturers/images");
      const res = await authFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "Image upload failed");
        setImagePreview(form.imageUrl || null);
        return;
      }
      const data = await res.json();
      setForm((f) => ({ ...f, imageUrl: data.url, imagePublicId: data.publicId }));
    } catch {
      setSubmitError("Image upload failed");
      setImagePreview(form.imageUrl || null);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "university/lecturers/cv");
      fd.append("type", "raw");
      const res = await authFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "CV upload failed");
        return;
      }
      const data = await res.json();
      setForm((f) => ({ ...f, cvUrl: data.url, cvPublicId: data.publicId }));
    } catch {
      setSubmitError("CV upload failed");
    } finally {
      setUploadingCv(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        degree: form.degree.trim() || undefined,
        departmentIds: form.departmentIds,
        courseIds: form.courseIds,
        imageUrl: form.imageUrl || undefined,
        imagePublicId: form.imagePublicId || undefined,
        cvUrl: form.cvUrl || undefined,
        cvPublicId: form.cvPublicId || undefined,
      };

      if (modal === "add") {
        const res = await authFetch("/api/lecturers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to create lecturer");
          return;
        }
      } else if (modal === "edit" && editingId) {
        const res = await authFetch(`/api/lecturers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to update lecturer");
          return;
        }
      }
      await loadLecturers();
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this lecturer?")) return;
    const res = await authFetch(`/api/lecturers/${id}`, { method: "DELETE" });
    if (res.ok) await loadLecturers();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  async function handleToggleActive(l: LecturerRow) {
    const res = await authFetch(`/api/lecturers/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !l.isActive }),
    });
    if (res.ok) await loadLecturers();
    else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  }

  const filtered = lecturers.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const deptNames = (l.departments ?? []).map((d) => d.name).join(" ");
    const courseNames = (l.courses ?? []).map((c) => c.name).join(" ");
    return (
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.degree ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").includes(q) ||
      deptNames.toLowerCase().includes(q) ||
      courseNames.toLowerCase().includes(q)
    );
  });

  function toggleDepartment(id: number) {
    setForm((f) => ({
      ...f,
      departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter((x) => x !== id) : [...f.departmentIds, id],
    }));
  }

  function toggleCourse(id: number) {
    setForm((f) => ({
      ...f,
      courseIds: f.courseIds.includes(id) ? f.courseIds.filter((x) => x !== id) : [...f.courseIds, id],
    }));
  }

  if (!hasPermission("lecturers.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Lecturers" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view lecturers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Lecturers" />
        {canCreate && (
          <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
            Add Lecturer
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Lecturers
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {filtered.length}
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search lecturers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2 pl-9 pr-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search ? "No lecturers match your search." : "No lecturers yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>#</TableCell>
                <TableCell isHeader>Name</TableCell>
                <TableCell isHeader>Email</TableCell>
                <TableCell isHeader>Departments</TableCell>
                <TableCell isHeader>Courses</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l, idx) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        {(l as LecturerRow & { imageUrl?: string }).imageUrl ? (
                          <Image src={(l as LecturerRow & { imageUrl?: string }).imageUrl!} alt="" width={36} height={36} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-500">
                            {l.name[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <Link href={`/lecturers/${l.id}`} className="font-semibold text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400">
                          {l.name}
                        </Link>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-300">{l.email}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(l.departments ?? []).length === 0 ? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      ) : (
                        (l.departments ?? []).map((d) => (
                          <Badge key={d.id} color="info" size="sm">
                            {d.code}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(l.courses ?? []).length === 0 ? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      ) : (
                        (l.courses ?? []).map((c) => (
                          <span key={c.id} title={c.name} className="inline-block">
                            <Badge color="primary" size="sm">
                              {c.code}
                            </Badge>
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(l)}
                        className="focus:outline-none"
                      >
                        <Badge color={l.isActive ? "success" : "error"} size="sm">
                          {l.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    ) : (
                      <Badge color={l.isActive ? "success" : "error"} size="sm">
                        {l.isActive ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/lecturers/${l.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                        aria-label="View Profile"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(l.id)}
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {modal === "add" ? "Add Lecturer" : "Edit Lecturer"}
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
                    Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="lecturer@university.edu"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Degree
                  </label>
                  <input
                    type="text"
                    value={form.degree}
                    onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))}
                    placeholder="e.g. Ph.D., M.Sc., B.Ed."
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                  />
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Profile Image
                    </label>
                    <div
                      className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-brand-400 hover:bg-brand-50/30 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {uploadingImage && <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />}
                      {!uploadingImage && imagePreview && <Image src={imagePreview} alt="Preview" fill className="object-cover" />}
                      {!uploadingImage && !imagePreview && (
                        <div className="flex flex-col items-center gap-0.5">
                          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-gray-500">Upload</span>
                        </div>
                      )}
                      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      CV (PDF)
                    </label>
                    <div className="flex items-center gap-2">
                      <input ref={cvInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleCvUpload} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cvInputRef.current?.click()}
                        disabled={uploadingCv}
                      >
                        {uploadingCv ? "Uploading..." : form.cvUrl ? "Replace CV" : "Upload CV"}
                      </Button>
                      {form.cvUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]" title={form.cvUrl}>
                          PDF uploaded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Departments
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2 dark:border-gray-700 dark:bg-gray-800/30">
                    {departments.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No departments available.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {departments.map((d) => (
                          <label
                            key={d.id}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 dark:has-[:checked]:border-brand-500 dark:has-[:checked]:bg-brand-500/10 dark:has-[:checked]:text-brand-400"
                          >
                            <input
                              type="checkbox"
                              checked={form.departmentIds.includes(d.id)}
                              onChange={() => toggleDepartment(d.id)}
                              className="sr-only"
                            />
                            <span>{d.code}</span>
                            <span className="text-gray-500 dark:text-gray-400">({d.name})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Courses
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2 dark:border-gray-700 dark:bg-gray-800/30">
                    {courses.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No courses available.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {courses.map((c) => (
                          <label
                            key={c.id}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 dark:has-[:checked]:border-brand-500 dark:has-[:checked]:bg-brand-500/10 dark:has-[:checked]:text-brand-400"
                          >
                            <input
                              type="checkbox"
                              checked={form.courseIds.includes(c.id)}
                              onChange={() => toggleCourse(c.id)}
                              className="sr-only"
                            />
                            <span>{c.code}</span>
                            <span className="text-gray-500 dark:text-gray-400">({c.department?.code})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setModal(null)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || uploadingImage || uploadingCv} size="sm">
                  {submitting ? "Saving..." : modal === "add" ? "Create Lecturer" : "Update Lecturer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
