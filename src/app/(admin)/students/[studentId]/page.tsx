"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { ChevronLeftIcon } from "@/icons";

type StudentProfile = {
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
  imageUrl: string | null;
  department: { id: number; name: string; code: string; tuitionFee: number | null };
  class: { id: number; name: string; semester: string; year: number; course: { code: string; name: string } } | null;
  program: string | null;
  status: string;
  admissionDate: string;
  tuitionPayments: { id: number; semester: string; year: number; amount: number; paidAt: string }[];
};

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const idCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      await authFetch(`/api/students/by-id/${encodeURIComponent(studentId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setStudent);
      setLoading(false);
    })();
  }, [studentId]);

  const handlePrintIdCard = () => {
    if (!idCardRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>ID Card - ${student?.studentId}</title>
        <style>
          body { font-family: system-ui; padding: 20px; margin: 0; }
          .id-card { width: 340px; border: 2px solid #333; border-radius: 12px; overflow: hidden; }
          .id-header { background: #465FFF; color: white; padding: 12px; text-align: center; font-weight: bold; }
          .id-body { padding: 16px; display: flex; gap: 16px; }
          .id-photo { width: 80px; height: 100px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
          .id-photo img { width: 80px; height: 100px; object-fit: cover; }
          .id-info { flex: 1; }
          .id-row { margin-bottom: 6px; font-size: 13px; }
          .id-id { font-size: 18px; font-weight: bold; letter-spacing: 1px; margin-bottom: 8px; }
        </style>
        </head>
        <body>
          <div class="id-card">
            <div class="id-header">Abaarso Tech University</div>
            <div class="id-body">
              <div class="id-photo">
                ${student?.imageUrl ? `<img src="${student.imageUrl}" alt="Photo" />` : `<span style="font-size: 32px;">${student?.firstName?.[0] || ""}${student?.lastName?.[0] || ""}</span>`}
              </div>
              <div class="id-info">
                <div class="id-id">${student?.studentId || ""}</div>
                <div class="id-row"><strong>${student?.firstName || ""} ${student?.lastName || ""}</strong></div>
                <div class="id-row">${student?.department?.name || ""} (${student?.department?.code || ""})</div>
                <div class="id-row">${student?.program || "—"} | ${student?.class ? `${student.class.course.code} ${student.class.name}` : "—"}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  if (!student) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Student Not Found" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">Student with ID {studentId} not found.</p>
          <Button className="mt-4" size="sm" onClick={() => router.push("/admission")}>
            Back to Admission
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle={`${student.firstName} ${student.lastName}`} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => router.push("/admission")}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronLeftIcon />
          Back to Admission
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrintIdCard}>
            Print ID Card
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ID Card Preview */}
        <div className="lg:col-span-1">
          <div
            ref={idCardRef}
            className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-white/5"
          >
            <div className="bg-brand-600 px-4 py-3 text-center font-bold text-white">
              Abaarso Tech University
            </div>
            <div className="flex gap-4 p-4">
              <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                {student.imageUrl ? (
                  <Image src={student.imageUrl} alt="" width={80} height={96} className="h-24 w-20 object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {student.firstName[0]}{student.lastName[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-lg font-bold tracking-wider text-gray-800 dark:text-white/90">
                  {student.studentId}
                </p>
                <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {student.department.name} ({student.department.code})
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {student.program || "—"} {student.class && `| ${student.class.course.code}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-white/5">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Student ID Number</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-gray-800 dark:text-white/90">
                {student.studentId}
              </p>
            </div>
            <Badge color="primary" size="sm">ID Card</Badge>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Student Profile</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Full Name</p>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {student.firstName} {student.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Student ID</p>
                <p className="font-mono font-medium text-gray-800 dark:text-white/90">{student.studentId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Department</p>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {student.department.name} ({student.department.code})
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Class</p>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {student.class ? `${student.class.course.code} - ${student.class.name} (${student.class.semester} ${student.class.year})` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Program</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{student.program || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</p>
                <Badge color="success" size="sm">{student.status}</Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{student.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{student.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Mother Name</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{student.motherName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Parent Phone</p>
                <p className="font-medium text-gray-800 dark:text-white/90">{student.parentPhone || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Admission Date</p>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {new Date(student.admissionDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Tuition Payments</h3>
            {student.tuitionPayments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {student.tuitionPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800"
                  >
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {p.semester} {p.year}
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ${p.amount.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(p.paidAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
