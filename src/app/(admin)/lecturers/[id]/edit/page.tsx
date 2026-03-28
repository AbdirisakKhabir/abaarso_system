"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import LecturerForm, { type CourseInfo, type DeptInfo, type LecturerFormState } from "@/components/lecturers/LecturerForm";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type LecturerApi = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  degree: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  cvUrl: string | null;
  cvPublicId: string | null;
  departments: DeptInfo[];
  courses: CourseInfo[];
};

export default function EditLecturerPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const rawId = params.id as string;
  const id = Number(rawId);

  const [lecturer, setLecturer] = useState<LecturerApi | null>(null);
  const [departments, setDepartments] = useState<DeptInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      setError("Invalid lecturer ID");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [lecRes, deptRes, courseRes] = await Promise.all([
          authFetch(`/api/lecturers/${id}`),
          authFetch("/api/departments"),
          authFetch("/api/courses"),
        ]);
        if (!lecRes.ok) {
          setError("Lecturer not found");
          setLoading(false);
          return;
        }
        const l = (await lecRes.json()) as LecturerApi;
        setLecturer(l);
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
      } catch {
        setError("Failed to load lecturer");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (!hasPermission("lecturers.edit")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Edit Lecturer" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to edit lecturers.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Edit Lecturer" />
        <div className="mt-6 flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
        </div>
      </div>
    );
  }

  if (error || !lecturer) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Edit Lecturer" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">{error ?? "Not found"}</p>
        </div>
      </div>
    );
  }

  const initialData: Partial<LecturerFormState> = {
    name: lecturer.name,
    email: lecturer.email,
    phone: lecturer.phone ?? "",
    degree: lecturer.degree ?? "",
    departmentIds: (lecturer.departments ?? []).map((d) => d.id),
    courseIds: (lecturer.courses ?? []).map((c) => c.id),
    imageUrl: lecturer.imageUrl ?? "",
    imagePublicId: lecturer.imagePublicId ?? "",
    cvUrl: lecturer.cvUrl ?? "",
    cvPublicId: lecturer.cvPublicId ?? "",
  };

  return (
    <div>
      <PageBreadCrumb pageTitle={`Edit ${lecturer.name}`} />
      <LecturerForm
        mode="edit"
        lecturerId={lecturer.id}
        initialData={initialData}
        departments={departments}
        courses={courses}
        onSuccess={() => router.push("/lecturers")}
      />
    </div>
  );
}
