"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import StudentRegistrationForm from "@/components/admission/StudentRegistrationForm";
import type { StudentFormData } from "@/components/admission/StudentRegistrationForm";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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

type Student = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  motherName: string | null;
  parentPhone: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  departmentId: number;
  admissionAcademicYearId: number | null;
  classId: number | null;
  program: string | null;
  status: string;
  paymentStatus: string;
  imageUrl: string | null;
  imagePublicId: string | null;
};

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const id = Number(params.id);
  const [student, setStudent] = useState<Student | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearInfo[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      setError("Invalid student ID");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [studentRes, deptRes, yearsRes, classRes] = await Promise.all([
          authFetch(`/api/students/${id}`),
          authFetch("/api/departments"),
          authFetch("/api/academic-years"),
          authFetch("/api/classes"),
        ]);
        if (!studentRes.ok) {
          setError("Student not found");
          setLoading(false);
          return;
        }
        const s = await studentRes.json();
        setStudent(s);
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(data.map((d: Department & Record<string, unknown>) => ({ id: d.id, name: d.name, code: d.code })));
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
      } catch {
        setError("Failed to load student");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (!hasPermission("admission.edit")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Edit Student" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to edit students.</p>
        </div>
      </div>
    );
  }

  if (loading || error) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Edit Student" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          ) : (
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (!student) return null;

  const initialData: Partial<StudentFormData> = {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        motherName: student.motherName ?? "",
        parentPhone: student.parentPhone ?? "",
        email: student.email ?? "",
        phone: student.phone ?? "",
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split("T")[0] : "",
        gender: student.gender ?? "",
        address: student.address ?? "",
        departmentId: String(student.departmentId),
        admissionAcademicYearId: student.admissionAcademicYearId ? String(student.admissionAcademicYearId) : "",
        classId: student.classId ? String(student.classId) : "",
        program: student.program ?? "",
        status: student.status,
        paymentStatus: student.paymentStatus ?? "Fully Paid",
        imageUrl: student.imageUrl ?? "",
        imagePublicId: student.imagePublicId ?? "",
      };

  return (
    <div>
      <PageBreadCrumb pageTitle={`Edit ${student?.firstName} ${student?.lastName}`} />
      <StudentRegistrationForm
        mode="edit"
        editingId={id}
        initialData={initialData}
        departments={departments}
        academicYears={academicYears}
        classes={classes}
        onSuccess={() => router.push("/admission")}
      />
    </div>
  );
}
