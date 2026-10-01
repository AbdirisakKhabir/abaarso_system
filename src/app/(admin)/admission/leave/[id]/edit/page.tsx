"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import StudentLeaveForm, { type LeaveFormRecord } from "@/components/admission/StudentLeaveForm";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function EditLeavePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [leave, setLeave] = useState<LeaveFormRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/students/leaves/${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not load leave.");
        return;
      }
      setLeave(data.leave);
    })();
  }, [id]);

  if (!hasPermission("admission.edit")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Edit Leave" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500">You do not have permission to edit student leave.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <PageBreadCrumb pageTitle="Edit Leave" />
      </div>
      <div className="mx-auto max-w-4xl min-w-0">
        {error ? (
          <p className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        ) : !leave ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <StudentLeaveForm
            leave={leave}
            cancelHref="/admission/leave"
            onSaved={() => router.push("/admission/leave")}
          />
        )}
      </div>
    </div>
  );
}
