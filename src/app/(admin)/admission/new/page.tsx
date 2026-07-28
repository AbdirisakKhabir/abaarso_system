"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import StudentRegistrationForm from "@/components/admission/StudentRegistrationForm";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_PROGRAM, parseProgram, programLabel, type Program } from "@/lib/program";

type Department = { id: number; name: string; code: string };
type AcademicYearInfo = { id: number; name: string; startYear: number; endYear: number };
type ClassInfo = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course: { code: string };
  departmentId?: number;
};

function NewStudentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const program = (parseProgram(searchParams.get("program")) ?? DEFAULT_PROGRAM) as Program;
  const listPath = program === "Masters" ? "/admission/masters" : "/admission/bachelor";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearInfo[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [deptRes, yearsRes, classRes] = await Promise.all([
        authFetch(`/api/departments?program=${encodeURIComponent(program)}`),
        authFetch("/api/academic-years"),
        authFetch(`/api/classes?program=${encodeURIComponent(program)}`),
      ]);
      if (deptRes.ok) {
        const data = await deptRes.json();
        const list = Array.isArray(data) ? data : data.items;
        setDepartments(
          (list || []).map((d: Department & Record<string, unknown>) => ({
            id: d.id,
            name: d.name,
            code: d.code,
          }))
        );
      }
      if (yearsRes.ok) {
        const data = await yearsRes.json();
        setAcademicYears(
          data.map((y: AcademicYearInfo) => ({
            id: y.id,
            name: y.name,
            startYear: y.startYear,
            endYear: y.endYear,
          }))
        );
      }
      if (classRes.ok) {
        const data = await classRes.json();
        const list = Array.isArray(data) ? data : data.items;
        setClasses(
          (list || []).map(
            (c: {
              id: number;
              name: string;
              semester: string;
              year: number;
              department?: { code?: string; id?: number };
            }) => ({
              id: c.id,
              name: c.name,
              semester: c.semester,
              year: c.year,
              course: { code: "" },
              departmentId: c.department?.id ?? 0,
            })
          )
        );
      }
      setLoading(false);
    })();
  }, [program]);

  const initialData = useMemo(() => ({ program }), [program]);

  if (!hasPermission("admission.create")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="New Student" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to register students.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="New Student" />
        <div className="mt-6 flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle={`New ${programLabel(program)} Student`} />
      <StudentRegistrationForm
        mode="add"
        initialData={initialData}
        departments={departments}
        academicYears={academicYears}
        classes={classes}
        listHref={listPath}
        onSuccess={() => router.push(listPath)}
      />
    </div>
  );
}

export default function NewStudentPage() {
  return (
    <Suspense
      fallback={
        <div className="mt-6 flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
        </div>
      }
    >
      <NewStudentPageInner />
    </Suspense>
  );
}
