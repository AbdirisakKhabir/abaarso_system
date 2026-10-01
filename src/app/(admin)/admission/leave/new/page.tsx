"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import StudentLeaveForm from "@/components/admission/StudentLeaveForm";
import { useAuth } from "@/context/AuthContext";

function NewLeavePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();

  if (!hasPermission("admission.edit")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="New Leave Request" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500">You do not have permission to record student leave.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <PageBreadCrumb pageTitle="New Leave Request" />
      </div>
      <div className="mx-auto max-w-4xl min-w-0">
        <StudentLeaveForm
          initialStudentCode={searchParams.get("student")}
          cancelHref="/admission/leave"
          onSaved={() => router.push("/admission/leave")}
        />
      </div>
    </div>
  );
}

export default function NewLeavePage() {
  return (
    <Suspense fallback={null}>
      <NewLeavePageInner />
    </Suspense>
  );
}
