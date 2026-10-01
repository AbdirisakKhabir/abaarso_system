"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { DateSelect } from "@/components/form/DateSelect";
import DocumentPreview from "@/components/common/DocumentPreview";
import { authFetch } from "@/lib/api";
import { programLabel } from "@/lib/program";
import { notifyError, notifySuccess } from "@/lib/sweetalert";

export const LEAVE_TYPE_OPTIONS = [
  "Medical",
  "Personal",
  "Academic",
  "Military Service",
  "Maternity/Paternity",
  "Other",
] as const;

export type LeaveStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  parentPhone: string | null;
  status: string;
  program: string;
  department: { id: number; name: string; code: string } | null;
};

/** Leave row fields the form edits (matches GET /api/students/leaves). */
export type LeaveFormRecord = {
  id: number;
  startDate: string;
  expectedEndDate: string | null;
  leaveType: string | null;
  leaveTypeOther: string | null;
  reason: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  parentPhone: string | null;
  documentUrl: string | null;
  documentPublicId: string | null;
  declarationSigned: boolean;
  approvalStatus: string;
  approvedByName: string | null;
  approvalDate: string | null;
  student: LeaveStudent;
};

type FormState = {
  contactEmail: string;
  contactPhone: string;
  parentPhone: string;
  leaveType: string;
  leaveTypeOther: string;
  startDate: string;
  expectedEndDate: string;
  reason: string;
  documentUrl: string;
  documentPublicId: string;
  declarationSigned: boolean;
  approved: "yes" | "no";
  approvalDate: string;
  approvedByName: string;
};

const today = () => new Date().toISOString().split("T")[0];

/** Leave dates are stored at UTC midnight — read them back as UTC. */
const toInputDate = (iso: string | null) => (iso ? new Date(iso).toISOString().split("T")[0] : "");

function initialState(leave?: LeaveFormRecord | null): FormState {
  if (leave) {
    return {
      contactEmail: leave.contactEmail ?? leave.student.email ?? "",
      contactPhone: leave.contactPhone ?? leave.student.phone ?? "",
      parentPhone: leave.parentPhone ?? leave.student.parentPhone ?? "",
      leaveType: leave.leaveType ?? "",
      leaveTypeOther: leave.leaveTypeOther ?? "",
      startDate: toInputDate(leave.startDate),
      expectedEndDate: toInputDate(leave.expectedEndDate),
      reason: leave.reason ?? "",
      documentUrl: leave.documentUrl ?? "",
      documentPublicId: leave.documentPublicId ?? "",
      declarationSigned: leave.declarationSigned,
      approved: leave.approvalStatus === "Rejected" ? "no" : "yes",
      approvalDate: toInputDate(leave.approvalDate),
      approvedByName: leave.approvedByName ?? "",
    };
  }
  return {
    contactEmail: "",
    contactPhone: "",
    parentPhone: "",
    leaveType: "",
    leaveTypeOther: "",
    startDate: today(),
    expectedEndDate: "",
    reason: "",
    documentUrl: "",
    documentPublicId: "",
    declarationSigned: false,
    approved: "yes",
    approvalDate: today(),
    approvedByName: "",
  };
}

const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const readOnlyCls =
  "flex h-10 w-full items-center rounded-lg border border-gray-100 bg-gray-50 px-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-gray-100 py-5 last:border-b-0 dark:border-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
        {n}. {title}
      </h3>
      {children}
    </section>
  );
}

type Props = {
  /** Existing leave to edit; omit to record a new leave request. */
  leave?: LeaveFormRecord | null;
  /** Student ID (e.g. STD-2026-0001) to preselect for a new request. */
  initialStudentCode?: string | null;
  /** Where Cancel goes. */
  cancelHref: string;
  onSaved: () => void;
};

export default function StudentLeaveForm({ leave, initialStudentCode, cancelHref, onSaved }: Props) {
  const isEdit = Boolean(leave);
  const [form, setForm] = useState<FormState>(() => initialState(leave));
  const [student, setStudent] = useState<LeaveStudent | null>(leave?.student ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeaveStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function pickStudent(s: LeaveStudent) {
    setStudent(s);
    setQuery("");
    setResults([]);
    setForm((f) => ({
      ...f,
      contactEmail: s.email ?? "",
      contactPhone: s.phone ?? "",
      parentPhone: s.parentPhone ?? "",
    }));
  }

  // Debounced student search (new requests only)
  useEffect(() => {
    if (isEdit) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authFetch(`/api/students/search?q=${encodeURIComponent(q)}&limit=10`);
        const data = res.ok ? await res.json() : [];
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, isEdit]);

  // Preselect a student passed from the student list (?student=STD-…)
  useEffect(() => {
    if (isEdit || !initialStudentCode) return;
    (async () => {
      const res = await authFetch(
        `/api/students/search?q=${encodeURIComponent(initialStudentCode)}&limit=5`
      );
      if (!res.ok) return;
      const data: LeaveStudent[] = await res.json();
      const match = data.find((s) => s.studentId === initialStudentCode);
      if (match) pickStudent(match);
    })();
  }, [initialStudentCode, isEdit]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "document");
      fd.append("folder", "university/students/leave-documents");
      const res = await authFetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Upload failed");
        return;
      }
      setForm((f) => ({ ...f, documentUrl: data.url, documentPublicId: data.publicId }));
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!student) return setError("Select a student.");
    if (!form.leaveType) return setError("Select the type of leave.");
    if (form.leaveType === "Other" && !form.leaveTypeOther.trim()) {
      return setError("Specify the type of leave.");
    }
    if (!form.startDate || !form.expectedEndDate) {
      return setError("Enter the start and end dates of the leave.");
    }
    if (form.expectedEndDate < form.startDate) {
      return setError("End date of leave cannot be before the start date.");
    }
    if (!form.reason.trim()) return setError("Enter the reason for leave.");
    if (!form.declarationSigned) {
      return setError("Confirm the student has signed the declaration.");
    }

    const payload = {
      studentId: student.id,
      leaveType: form.leaveType,
      leaveTypeOther: form.leaveType === "Other" ? form.leaveTypeOther : null,
      startDate: form.startDate,
      expectedEndDate: form.expectedEndDate,
      reason: form.reason,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      parentPhone: form.parentPhone,
      documentUrl: form.documentUrl || null,
      documentPublicId: form.documentPublicId || null,
      declarationSigned: form.declarationSigned,
      approved: form.approved === "yes",
      approvalDate: form.approvalDate || null,
      approvedByName: form.approvedByName,
    };

    setSaving(true);
    try {
      const res = await authFetch(
        isEdit ? `/api/students/leaves/${leave!.id}` : "/api/students/leaves",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error ?? "Could not save leave.";
        setError(msg);
        await notifyError("Could not save leave", msg);
        return;
      }
      const fixed = Number(data?.attendanceSetPresent) || 0;
      const fixedText =
        fixed > 0 ? ` ${fixed} attendance record(s) in the leave period were set to Present.` : "";
      if (isEdit) {
        await notifySuccess("Leave updated", `Leave details saved.${fixedText}`);
      } else if (form.approved === "yes") {
        await notifySuccess(
          "Student put on leave",
          `${student.studentId} is on leave until ${form.expectedEndDate}. Attendance is marked Present for this period.${fixedText}`
        );
      } else {
        await notifySuccess("Leave request recorded", "Saved to leave history as not approved.");
      }
      onSaved();
    } catch {
      setError("Could not save leave.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {isEdit ? "Edit Student Leave" : "Student Leave Form"}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Abaarso Tech University Berbera — Academic Office
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6">
        <Section n={1} title="Student Information">
          {!isEdit && !student && (
            <div className="relative mb-3">
              <label className={labelCls}>
                Find student <span className="text-error-500">*</span>
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by student ID, name, phone or email"
                className={inputCls}
                autoFocus
              />
              {(results.length > 0 || searching) && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {searching && results.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>
                  ) : (
                    results.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickStudent(s)}
                        disabled={s.status === "Leave"}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
                      >
                        <span className="text-gray-800 dark:text-white/90">
                          {s.firstName} {s.lastName}
                          <span className="ml-2 font-mono text-xs text-gray-500">{s.studentId}</span>
                        </span>
                        <span className="text-xs text-gray-400">
                          {s.status === "Leave" ? "Already on leave" : s.department?.code}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {student && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Full Name</label>
                <div className={readOnlyCls}>
                  {student.firstName} {student.lastName}
                </div>
              </div>
              <div>
                <label className={labelCls}>Student ID</label>
                <div className={`${readOnlyCls} justify-between font-mono`}>
                  {student.studentId}
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={() => setStudent(null)}
                      className="font-sans text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Program / Department</label>
                <div className={readOnlyCls}>
                  {programLabel(student.program as "Bachelor" | "Masters")}
                  {student.department ? ` — ${student.department.name}` : ""}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Contact Email</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contact Phone Number</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Parent Phone Number</label>
                <input
                  type="tel"
                  value={form.parentPhone}
                  onChange={(e) => set("parentPhone", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </Section>

        <Section n={2} title="Type of Leave Requested">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {LEAVE_TYPE_OPTIONS.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.leaveType === t
                    ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-300"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/3"
                }`}
              >
                <input
                  type="radio"
                  name="leaveType"
                  value={t}
                  checked={form.leaveType === t}
                  onChange={() => set("leaveType", t)}
                  className="h-4 w-4 accent-brand-500"
                />
                {t === "Other" ? "Other (specify)" : `${t} Leave`}
              </label>
            ))}
          </div>
          {form.leaveType === "Other" && (
            <input
              type="text"
              value={form.leaveTypeOther}
              onChange={(e) => set("leaveTypeOther", e.target.value)}
              placeholder="Specify type of leave"
              className={`${inputCls} mt-3`}
            />
          )}
        </Section>

        <Section n={3} title="Leave Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateSelect
              id="leave-start"
              label={
                <>
                  Start Date of Leave <span className="text-error-500">*</span>
                </>
              }
              value={form.startDate}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  startDate: v,
                  // Keep the end date valid when the start moves past it
                  expectedEndDate: f.expectedEndDate && v && f.expectedEndDate < v ? "" : f.expectedEndDate,
                }))
              }
              required
            />
            <DateSelect
              id="leave-end"
              label={
                <>
                  End Date of Leave <span className="text-error-500">*</span>
                </>
              }
              value={form.expectedEndDate}
              minDate={form.startDate || undefined}
              onChange={(v) => set("expectedEndDate", v)}
              required
            />
            <div className="sm:col-span-2">
              <label className={labelCls}>
                Reason for Leave <span className="text-error-500">*</span>
              </label>
              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            While the leave is ongoing, the student&apos;s attendance is recorded as{" "}
            <strong>Present</strong> until the end date.
          </p>
        </Section>

        <Section n={4} title="Supporting Documentation">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Attach medical certificates, legal documents, or other relevant paperwork (PDF or
            image, max 10MB).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : form.documentUrl ? "Replace document" : "Attach document"}
            </Button>
            {form.documentUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, documentUrl: "", documentPublicId: "" }))}
                className="text-xs text-error-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          {form.documentUrl && (
            <div className="mt-3">
              <DocumentPreview key={form.documentUrl} url={form.documentUrl} />
            </div>
          )}
        </Section>

        <Section n={5} title="Declaration">
          <p className="mb-3 text-sm italic text-gray-600 dark:text-gray-400">
            &ldquo;I hereby declare that the information provided in this leave request form is
            true and accurate. I understand that granting of the leave is subject to the
            approval of the university and compliance with the University Leave Policy.&rdquo;
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.declarationSigned}
              onChange={(e) => set("declarationSigned", e.target.checked)}
              className="h-4 w-4 accent-brand-500"
            />
            The student has signed the declaration <span className="text-error-500">*</span>
          </label>
        </Section>

        <Section n={6} title="Leave Request Approval">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <span className={labelCls}>Approved</span>
              {isEdit ? (
                <div className={readOnlyCls}>{form.approved === "yes" ? "Yes" : "No"}</div>
              ) : (
                <div className="flex h-10 items-center gap-4">
                  {(["yes", "no"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="approved"
                        checked={form.approved === v}
                        onChange={() => set("approved", v)}
                        className="h-4 w-4 accent-brand-500"
                      />
                      {v === "yes" ? "Yes" : "No"}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DateSelect
              id="leave-approval-date"
              label="Date"
              value={form.approvalDate}
              onChange={(v) => set("approvalDate", v)}
            />
            <div>
              <label className={labelCls}>Approving Authority Name</label>
              <input
                type="text"
                value={form.approvedByName}
                onChange={(e) => set("approvedByName", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {!isEdit && form.approved === "no" && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              A request that is not approved is kept in leave history only. The student&apos;s
              status and attendance are not changed.
            </p>
          )}
        </Section>

        {error && (
          <div className="mb-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </div>
        )}

        <div className="-mx-6 flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <Link
            href={cancelHref}
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3"
          >
            Cancel
          </Link>
          <Button type="submit" size="sm" disabled={saving || uploading || !student}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Submit leave"}
          </Button>
        </div>
      </form>
    </div>
  );
}
