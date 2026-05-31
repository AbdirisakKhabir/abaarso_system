"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { authFetch } from "@/lib/api";
import { ChevronLeftIcon } from "@/icons";
import SearchableMultiSelect, { type SearchableOption } from "./SearchableMultiSelect";

export type DeptInfo = { id: number; name: string; code: string };
export type CourseInfo = { id: number; name: string; code: string; department: DeptInfo };

export type LecturerFormState = {
  name: string;
  email: string;
  phone: string;
  degree: string;
  departmentIds: number[];
  courseIds: number[];
  imageUrl: string;
  imagePublicId: string;
  cvUrl: string;
  cvPublicId: string;
};

const defaultForm: LecturerFormState = {
  name: "",
  email: "",
  phone: "",
  degree: "",
  departmentIds: [],
  courseIds: [],
  imageUrl: "",
  imagePublicId: "",
  cvUrl: "",
  cvPublicId: "",
};

type Props = {
  mode: "add" | "edit";
  lecturerId?: number;
  initialData?: Partial<LecturerFormState>;
  departments: DeptInfo[];
  courses: CourseInfo[];
  onSuccess: () => void;
};

export default function LecturerForm({
  mode,
  lecturerId,
  initialData,
  departments,
  courses,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<LecturerFormState>({ ...defaultForm, ...initialData });
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deptOptions: SearchableOption[] = departments.map((d) => ({
    id: d.id,
    primary: d.code,
    secondary: d.name,
  }));

  const courseOptions: SearchableOption[] = courses.map((c) => ({
    id: c.id,
    primary: c.code,
    secondary: `${c.name} · ${c.department?.code ?? ""}`,
  }));

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

      if (mode === "add") {
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
      } else if (mode === "edit" && lecturerId) {
        const res = await authFetch(`/api/lecturers/${lecturerId}`, {
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
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:bg-gray-800";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/lecturers"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Lecturers
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5">
            <h1 className="text-xl font-bold text-white">
              {mode === "add" ? "Add Lecturer" : "Edit Lecturer"}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {mode === "add" ? "Register a new lecturer and assign departments and courses." : "Update lecturer details."}
            </p>
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-400">
            {submitError}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-4">
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
                className={inputClass}
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
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+252 xxx xxx"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Degree</label>
              <input
                type="text"
                value={form.degree}
                onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))}
                placeholder="e.g. Ph.D., M.Sc."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">Profile & documents</div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Profile image</label>
              <div
                className="relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-brand-400 dark:border-gray-600 dark:bg-gray-800"
                onClick={() => imageInputRef.current?.click()}
              >
                {uploadingImage && (
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                )}
                {!uploadingImage && imagePreview && <Image src={imagePreview} alt="Preview" fill className="object-cover" />}
                {!uploadingImage && !imagePreview && (
                  <span className="text-xs text-gray-500">Click to upload</span>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">CV (PDF)</label>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={cvInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleCvUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => cvInputRef.current?.click()} disabled={uploadingCv}>
                  {uploadingCv ? "Uploading…" : form.cvUrl ? "Replace CV" : "Upload CV"}
                </Button>
                {form.cvUrl && <span className="text-xs text-gray-500 dark:text-gray-400">PDF attached</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <SearchableMultiSelect
            label="Departments"
            options={deptOptions}
            selectedIds={form.departmentIds}
            onChange={(departmentIds) => setForm((f) => ({ ...f, departmentIds }))}
            searchPlaceholder="Search by code or name…"
            emptyHint="No departments match your search."
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <SearchableMultiSelect
            label="Courses"
            options={courseOptions}
            selectedIds={form.courseIds}
            onChange={(courseIds) => setForm((f) => ({ ...f, courseIds }))}
            searchPlaceholder="Search by code, course name, or department…"
            emptyHint="No courses match your search."
          />
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row dark:border-gray-700 dark:bg-gray-900">
          <Link href="/lecturers" className="w-full sm:w-auto">
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting || uploadingImage || uploadingCv} size="sm" className="w-full sm:w-auto">
            {submitting ? "Saving…" : mode === "add" ? "Create lecturer" : "Update lecturer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
