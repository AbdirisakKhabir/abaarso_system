"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import StudentRegistrationForm from "@/components/admission/StudentRegistrationForm";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Department = { id: number; name: string; code: string };
type ClassInfo = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course: { code: string };
  departmentId?: number;
};

export default function NewStudentPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [deptRes, classRes] = await Promise.all([
        authFetch("/api/departments"),
        authFetch("/api/classes"),
      ]);
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.map((d: Department & Record<string, unknown>) => ({ id: d.id, name: d.name, code: d.code })));
      }
      if (classRes.ok) {
        const data = await classRes.json();
        setClasses(
            data.map((c: { id: number; name: string; semester: string; year: number; department?: { code?: string; id?: number } }) => ({
            id: c.id,
            name: c.name,
            semester: c.semester,
            year: c.year,
            department: { code: c.department?.code ?? "" },
            departmentId: c.department?.id ?? 0,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (!hasPermission("admission.create")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="New Student" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to register students.</p>
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
      <PageBreadCrumb pageTitle="New Student Registration" />
      <StudentRegistrationForm
        mode="add"
        departments={departments}
        classes={classes}
        onSuccess={() => router.push("/admission")}
      />
    </div>
  );
}
