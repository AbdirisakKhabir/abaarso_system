"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api";
import { programLabel, type Program } from "@/lib/program";

type Department = { id: number; name: string; code: string };
type Faculty = { id: number; name: string; code: string };
type ClassItem = { id: number; name: string; semester: string; year: number };
type Semester = { id: number; name: string };

type Props = {
  program: Program;
  onClose: () => void;
  /** Called after the file downloads, with the department used (to preselect it for import). */
  onExported: (departmentId: number) => void;
};

const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const linkBtnCls = "text-xs font-medium text-brand-600 hover:underline dark:text-brand-400";

/** API lists return an array, or `{ items }` when paginated. */
async function fetchList<T>(url: string): Promise<T[]> {
  const res = await authFetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

export default function TemplateExportModal({ program, onClose, onExported }: Props) {
  const { hasPermission } = useAuth();
  const canCreateDept = hasPermission("departments.create");
  const canCreateClass = hasPermission("classes.create");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newDeptOpen, setNewDeptOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "", facultyId: "", tuitionFee: "" });
  const [newClassOpen, setNewClassOpen] = useState(false);
  const [newClass, setNewClass] = useState({
    name: "",
    semester: "",
    year: String(new Date().getFullYear()),
  });

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      setDepartments(await fetchList<Department>(`/api/departments?program=${encodeURIComponent(program)}`));
    } finally {
      setLoadingDepts(false);
    }
  }, [program]);

  const loadClasses = useCallback(
    async (deptId: string) => {
      if (!deptId) {
        setClasses([]);
        return;
      }
      setLoadingClasses(true);
      try {
        setClasses(
          await fetchList<ClassItem>(
            `/api/classes?program=${encodeURIComponent(program)}&departmentId=${encodeURIComponent(deptId)}`
          )
        );
      } finally {
        setLoadingClasses(false);
      }
    },
    [program]
  );

  useEffect(() => {
    void loadDepartments();
    void fetchList<Faculty>(`/api/faculties?program=${encodeURIComponent(program)}`).then(setFaculties);
    void fetchList<Semester>(`/api/semesters?active=true&program=${encodeURIComponent(program)}`).then(setSemesters);
  }, [loadDepartments, program]);

  useEffect(() => {
    setClassId("");
    setNewClassOpen(false);
    void loadClasses(departmentId);
  }, [departmentId, loadClasses]);

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name)),
    [classes]
  );

  async function createDepartment() {
    setError("");
    if (!newDept.name.trim() || !newDept.code.trim() || !newDept.facultyId) {
      setError("Department name, code and faculty are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDept.name.trim(),
          code: newDept.code.trim(),
          facultyId: Number(newDept.facultyId),
          tuitionFee: newDept.tuitionFee ? Number(newDept.tuitionFee) : undefined,
          program,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create department.");
        return;
      }
      await loadDepartments();
      setDepartmentId(String(data.id));
      setNewDeptOpen(false);
      setNewDept({ name: "", code: "", facultyId: "", tuitionFee: "" });
    } finally {
      setBusy(false);
    }
  }

  async function createClass() {
    setError("");
    if (!departmentId) {
      setError("Select a department first.");
      return;
    }
    if (!newClass.name.trim() || !newClass.semester || !newClass.year) {
      setError("Class name, semester and year are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClass.name.trim(),
          departmentId: Number(departmentId),
          semester: newClass.semester,
          year: Number(newClass.year),
          program,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create class.");
        return;
      }
      await loadClasses(departmentId);
      setClassId(String(data.id));
      setNewClassOpen(false);
      setNewClass((c) => ({ ...c, name: "" }));
    } finally {
      setBusy(false);
    }
  }

  async function exportTemplate() {
    setError("");
    if (!departmentId || !classId) {
      setError("Select a department and a class.");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(
        `/api/students/template?departmentId=${encodeURIComponent(departmentId)}&classId=${encodeURIComponent(classId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to download template.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "Student_Import_Template.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onExported(Number(departmentId));
    } catch {
      setError("Failed to download template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlayGate>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
        <div className="my-8 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Export Student Template</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{programLabel(program)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The template is prepared for one department and class. Every row comes filled with
              them, so you only enter student details.
            </p>

            {/* Department */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={labelCls.replace("mb-1.5 ", "")}>
                  Department <span className="text-error-500">*</span>
                </label>
                {canCreateDept && !newDeptOpen && (
                  <button type="button" onClick={() => setNewDeptOpen(true)} className={linkBtnCls}>
                    + New department
                  </button>
                )}
              </div>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={loadingDepts}
                className={inputCls}
              >
                <option value="">
                  {loadingDepts
                    ? "Loading departments…"
                    : departments.length === 0
                      ? "No departments yet — create one"
                      : "Select department"}
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>

              {newDeptOpen && (
                <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-white/3">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">New department</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      value={newDept.name}
                      onChange={(e) => setNewDept((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Name"
                      className={`${inputCls} sm:col-span-2`}
                    />
                    <input
                      value={newDept.code}
                      onChange={(e) => setNewDept((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                      placeholder="Code (e.g. ICT)"
                      className={inputCls}
                    />
                    <select
                      value={newDept.facultyId}
                      onChange={(e) => setNewDept((d) => ({ ...d, facultyId: e.target.value }))}
                      className={`${inputCls} sm:col-span-2`}
                    >
                      <option value="">{faculties.length === 0 ? "No faculties found" : "Select faculty"}</option>
                      {faculties.map((f) => (
                        <option key={f.id} value={String(f.id)}>
                          {f.code} — {f.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={newDept.tuitionFee}
                      onChange={(e) => setNewDept((d) => ({ ...d, tuitionFee: e.target.value }))}
                      placeholder="Tuition fee"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setNewDeptOpen(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void createDepartment()} disabled={busy}>
                      {busy ? "Saving…" : "Create department"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Class */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={labelCls.replace("mb-1.5 ", "")}>
                  Class <span className="text-error-500">*</span>
                </label>
                {canCreateClass && departmentId && !newClassOpen && (
                  <button type="button" onClick={() => setNewClassOpen(true)} className={linkBtnCls}>
                    + New class
                  </button>
                )}
              </div>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={!departmentId || loadingClasses}
                className={inputCls}
              >
                <option value="">
                  {!departmentId
                    ? "Select department first"
                    : loadingClasses
                      ? "Loading classes…"
                      : sortedClasses.length === 0
                        ? "No classes in this department — create one"
                        : "Select class"}
                </option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} · {c.semester} {c.year}
                  </option>
                ))}
              </select>

              {newClassOpen && (
                <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-white/3">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">New class</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      value={newClass.name}
                      onChange={(e) => setNewClass((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Class name (e.g. Batch 3- ICT-5)"
                      className={`${inputCls} sm:col-span-3`}
                    />
                    <select
                      value={newClass.semester}
                      onChange={(e) => setNewClass((c) => ({ ...c, semester: e.target.value }))}
                      className={`${inputCls} sm:col-span-2`}
                    >
                      <option value="">{semesters.length === 0 ? "No semesters found" : "Select semester"}</option>
                      {semesters.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={newClass.year}
                      onChange={(e) => setNewClass((c) => ({ ...c, year: e.target.value }))}
                      placeholder="Year"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setNewClassOpen(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void createClass()} disabled={busy}>
                      {busy ? "Saving…" : "Create class"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void exportTemplate()} disabled={busy || !departmentId || !classId}>
              {busy ? "Please wait…" : "Export template"}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlayGate>
  );
}
