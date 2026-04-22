"use client";

import { useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import TakeAttendanceForm from "@/components/attendance/TakeAttendanceForm";
import { useAuth } from "@/context/AuthContext";

export default function TakeAttendancePage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  if (!hasPermission("attendance.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Take attendance" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view attendance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <PageBreadCrumb pageTitle="Take attendance" />
      </div>
      <div className="mx-auto max-w-3xl min-w-0">
        <TakeAttendanceForm onSuccess={() => router.push("/attendance")} />
      </div>
    </div>
  );
}
