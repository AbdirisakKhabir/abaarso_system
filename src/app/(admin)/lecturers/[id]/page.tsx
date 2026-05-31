"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronLeftIcon,
  UserCircleIcon,
  MailIcon,
  GroupIcon,
  FileIcon,
} from "@/icons";

type DeptInfo = { id: number; name: string; code: string };
type CourseInfo = { id: number; name: string; code: string; department: DeptInfo };

type LecturerProfile = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  degree: string | null;
  imageUrl: string | null;
  cvUrl: string | null;
  isActive: boolean;
  departments: DeptInfo[];
  courses: CourseInfo[];
};

export default function LecturerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const id = params.id as string;
  const [lecturer, setLecturer] = useState<LecturerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const res = await authFetch(`/api/lecturers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLecturer(data);
      } else {
        setLecturer(null);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  if (!lecturer) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Lecturer Not Found" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">Lecturer not found.</p>
          <Button className="mt-4" size="sm" onClick={() => router.push("/lecturers")}>
            Back to Lecturers
          </Button>
        </div>
      </div>
    );
  }

  const InfoRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 font-medium text-gray-800 dark:text-white/90">{value}</p>
      </div>
    </div>
  );

  return (
    <div>
      <PageBreadCrumb pageTitle={lecturer.name} />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => router.push("/lecturers")}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Lecturers
        </button>
        {hasPermission("lecturers.edit") && (
          <Link
            href={`/lecturers/${lecturer.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-brand-600 shadow-sm transition-colors hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            Edit lecturer
          </Link>
        )}
      </div>

      {/* Hero Profile Card */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="relative bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-6 py-8 sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white/30 shadow-xl ring-2 ring-white/20">
              {lecturer.imageUrl ? (
                <Image src={lecturer.imageUrl} alt="" width={96} height={96} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/20">
                  <span className="text-3xl font-bold text-white">
                    {lecturer.name[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                {lecturer.name}
              </h1>
              <p className="mt-1 text-lg text-white/90">{lecturer.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-medium ring-1 ${lecturer.isActive ? "bg-green-500/30 text-white ring-green-400/50" : "bg-gray-500/30 text-white/90 ring-gray-400/50"}`}>
                  {lecturer.isActive ? "Active" : "Inactive"}
                </span>
                {lecturer.degree && (
                  <span className="text-sm text-white/80">{lecturer.degree}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Profile & CV */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              <FileIcon className="h-5 w-5 text-brand-500" />
              Curriculum Vitae
            </h3>
            {lecturer.cvUrl ? (
              <div className="space-y-3">
                <div className="flex h-48 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <iframe
                    src={`${lecturer.cvUrl}#toolbar=0`}
                    title="Lecturer CV"
                    className="h-full w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <a
                    href={lecturer.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                  <a
                    href={lecturer.cvUrl}
                    download
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 dark:border-gray-700">
                <FileIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No CV uploaded yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Profile Details */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              <UserCircleIcon className="h-5 w-5 text-brand-500" />
              Personal Information
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={UserCircleIcon} label="Full Name" value={lecturer.name} />
              <InfoRow icon={MailIcon} label="Email" value={lecturer.email} />
              <InfoRow icon={UserCircleIcon} label="Phone" value={lecturer.phone || "—"} />
              <InfoRow icon={UserCircleIcon} label="Degree" value={lecturer.degree || "—"} />
              <InfoRow
                icon={UserCircleIcon}
                label="Status"
                value={lecturer.isActive ? "Active" : "Inactive"}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              <GroupIcon className="h-5 w-5 text-brand-500" />
              Departments & Courses
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Departments</p>
                {lecturer.departments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {lecturer.departments.map((d) => (
                      <span
                        key={d.id}
                        className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
                      >
                        {d.code} {d.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Courses</p>
                {lecturer.courses.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {lecturer.courses.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
                      >
                        {c.code} {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
