"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import StudentRegistrationForm from "@/components/admission/StudentRegistrationForm";
import type { StudentFormData } from "@/components/admission/StudentRegistrationForm";
import { authFetch } from "@/lib/api";
import { DEFAULT_PROGRAM } from "@/lib/program";
import { useAuth } from "@/context/AuthContext";

type Department = { id: number; name: string; code: string; program?: string };
type AcademicYearInfo = { id: number; name: string; startYear: number; endYear: number };
type ClassInfo = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course: { code: string };
  departmentId?: number;
  department?: { id: number; code: string; name: string };
};

type Student = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  motherName: string | null;
  parentName: string | null;
  parentPhone: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  admissionDate: string;
  gender: string | null;
  address: string | null;
  departmentId: number;
  admissionAcademicYearId: number | null;
  classId: number | null;
  program: string | null;
  status: string;
  paymentStatus: string;
  customSemesterFee: number | null;
  balance: number;
  imageUrl: string | null;
  imagePublicId: string | null;
};

function toDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const raw = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (m) return m[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

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
        const studentRes = await authFetch(`/api/students/${id}`);
        if (!studentRes.ok) {
          setError("Student not found");
          setLoading(false);
          return;
        }
        const s: Student = await studentRes.json();
        setStudent(s);

        const program = s.program || DEFAULT_PROGRAM;
        const [deptRes, yearsRes, classRes] = await Promise.all([
          authFetch(`/api/departments?program=${encodeURIComponent(program)}`),
          authFetch("/api/academic-years"),
          authFetch(
            `/api/classes?program=${encodeURIComponent(program)}&departmentId=${s.departmentId}`
          ),
        ]);

        if (deptRes.ok) {
          const data = await deptRes.json();
          const list = Array.isArray(data) ? data : data.items;
          setDepartments(
            (list || []).map((d: Department) => ({
              id: d.id,
              name: d.name,
              code: d.code,
              program: d.program,
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
                department?: { code?: string; id?: number; name?: string };
              }) => ({
                id: c.id,
                name: c.name,
                semester: c.semester,
                year: c.year,
                course: { code: "" },
                department: {
                  id: c.department?.id ?? 0,
                  code: c.department?.code ?? "",
                  name: c.department?.name ?? "",
                },
                departmentId: c.department?.id ?? 0,
              })
            )
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

  const listHref = student.program === "Masters" ? "/admission/masters" : "/admission/bachelor";

  const initialData: Partial<StudentFormData> = {
    studentId: student.studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    motherName: student.motherName ?? "",
    parentName: student.parentName ?? "",
    parentPhone: student.parentPhone ?? "",
    email: student.email ?? "",
    phone: student.phone ?? "",
    dateOfBirth: toDateOnly(student.dateOfBirth),
    admissionDate: toDateOnly(student.admissionDate) || new Date().toISOString().slice(0, 10),
    gender: student.gender ?? "",
    address: student.address ?? "",
    departmentId: String(student.departmentId),
    admissionAcademicYearId: student.admissionAcademicYearId
      ? String(student.admissionAcademicYearId)
      : "",
    classId: student.classId ? String(student.classId) : "",
    program: student.program || DEFAULT_PROGRAM,
    status: student.status,
    paymentStatus: student.paymentStatus ?? "Fully Paid",
    customSemesterFee:
      student.customSemesterFee != null ? String(student.customSemesterFee) : "",
    balance: String(Number(student.balance ?? 0)),
    imageUrl: student.imageUrl ?? "",
    imagePublicId: student.imagePublicId ?? "",
  };

  return (
    <div>
      <PageBreadCrumb pageTitle={`Edit ${student.firstName} ${student.lastName}`} />
      <StudentRegistrationForm
        mode="edit"
        editingId={id}
        initialData={initialData}
        departments={departments}
        academicYears={academicYears}
        classes={classes}
        listHref={listHref}
        onSuccess={() => router.push(listHref)}
      />
    </div>
  );
}
