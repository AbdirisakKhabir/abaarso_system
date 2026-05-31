"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import LecturerForm, { type CourseInfo, type DeptInfo } from "@/components/lecturers/LecturerForm";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function NewLecturerPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState<DeptInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [deptRes, courseRes] = await Promise.all([authFetch("/api/departments"), authFetch("/api/courses")]);
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.map((d: DeptInfo) => ({ id: d.id, name: d.name, code: d.code })));
      }
      if (courseRes.ok) {
        const data = await courseRes.json();
        setCourses(
          data.map((c: CourseInfo & { department?: DeptInfo }) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            department: c.department ?? { id: 0, name: "", code: "" },
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (!hasPermission("lecturers.create")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Add Lecturer" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to add lecturers.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Add Lecturer" />
        <div className="mt-6 flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Add Lecturer" />
      <LecturerForm
        mode="add"
        departments={departments}
        courses={courses}
        onSuccess={() => router.push("/lecturers")}
      />
    </div>
  );
}
