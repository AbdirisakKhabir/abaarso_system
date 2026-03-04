"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeftIcon } from "@/icons";

type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course: { code: string; department: { id: number } };
};

type SearchStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  department: { id: number; name: string; code: string };
  class: { id: number; name: string; semester: string; year: number; course: { code: string } } | null;
};

export default function TransferStudentPage() {
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null);
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canTransfer = hasPermission("admission.edit");

  useEffect(() => {
    authFetch("/api/departments").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setDepartments(d.map((x: DepartmentOption) => ({ id: x.id, name: x.name, code: x.code })));
      }
    });
    authFetch("/api/classes").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setClasses(
          d.map((c: ClassOption & { course?: { department?: { id: number } } }) => ({
            id: c.id,
            name: c.name,
            semester: c.semester,
            year: c.year,
            course: {
              code: c.course?.code ?? "",
              department: { id: c.course?.department?.id ?? 0 },
            },
          }))
        );
      }
    });
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await authFetch(`/api/students/search?q=${encodeURIComponent(q)}&limit=15`);
        if (res.ok) setSearchResults(await res.json());
        else setSearchResults([]);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Classes filtered by selected department (for transfer target)
  const effectiveDeptId = newDepartmentId ? Number(newDepartmentId) : selectedStudent?.department.id ?? 0;
  const classOptionsForDept = classes.filter((c) => c.course.department.id === effectiveDeptId);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!selectedStudent) {
      setError("Select a student first");
      return;
    }
    if (!newDepartmentId && !newClassId) {
      setError("Select at least a new department or class");
      return;
    }

    setSubmitting(true);
    try {
      const body: { studentId: number; departmentId?: number; classId?: number } = {
        studentId: selectedStudent.id,
      };
      if (newDepartmentId) body.departmentId = Number(newDepartmentId);
      if (newClassId) body.classId = Number(newClassId);

      const res = await authFetch("/api/students/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Transfer failed");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSelectedStudent({
        ...selectedStudent,
        department: data.department,
        class: data.class,
      });
      setNewDepartmentId("");
      setNewClassId("");
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canTransfer) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Transfer Student" />
        <p className="text-gray-500 dark:text-gray-400">You do not have permission to transfer students.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageBreadCrumb pageTitle="Transfer Student" />
        <Link href="/admission">
          <Button variant="outline" size="sm" startIcon={<ChevronLeftIcon />}>
            Back to Admission
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            Student transferred successfully.
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-6">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div>
            <label className="mb-2 block text-sm font-medium">Search Student</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, student ID, email..."
              className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {searchLoading && <p className="mt-1 text-xs text-gray-500">Searching...</p>}
            {searchResults.length > 0 && !selectedStudent && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {searchResults.map((s) => (
                  <li
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedStudent(s);
                      setSearchResults([]);
                      setSearchQuery(`${s.firstName} ${s.lastName} (${s.studentId})`);
                      setNewDepartmentId("");
                      setNewClassId("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedStudent(s)}
                    className="cursor-pointer border-b border-gray-100 px-4 py-2 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    {s.firstName} {s.lastName} — {s.studentId} — {s.department.code}
                    {s.class && ` (${s.class.name})`}
                  </li>
                ))}
              </ul>
            )}
            {selectedStudent && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                <div>
                  <span className="font-medium">
                    {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.studentId})
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    Dept: {selectedStudent.department.code} — Class: {selectedStudent.class?.name ?? "None"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedStudent(null); setSearchQuery(""); setNewDepartmentId(""); setNewClassId(""); }}
                >
                  Change
                </Button>
              </div>
            )}
          </div>

          {selectedStudent && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Transfer to Department (optional)</label>
                <select
                  value={newDepartmentId}
                  onChange={(e) => { setNewDepartmentId(e.target.value); setNewClassId(""); }}
                  className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">— Keep current —</option>
                  {departments
                    .filter((d) => d.id !== selectedStudent.department.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Changing department will clear the student&apos;s class. Select a new class below if needed.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Transfer to Class (optional)</label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">— No class / Clear class —</option>
                  {classOptionsForDept.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.course.code} ({c.semester} {c.year})
                    </option>
                  ))}
                  {effectiveDeptId && classOptionsForDept.length === 0 && (
                    <option value="" disabled>No classes in selected department</option>
                  )}
                </select>
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Transferring..." : "Transfer Student"}
              </Button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
