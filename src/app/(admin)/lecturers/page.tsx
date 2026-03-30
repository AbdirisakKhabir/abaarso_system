"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { globalRowIndex, usePagination } from "@/hooks/usePagination";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";

type DeptInfo = { id: number; name: string; code: string };
type CourseInfo = { id: number; name: string; code: string; department: DeptInfo };

type LecturerRow = {
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
  createdAt: string;
};

export default function LecturersPage() {
  const { hasPermission } = useAuth();
  const [lecturers, setLecturers] = useState<LecturerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const canCreate = hasPermission("lecturers.create");
  const canEdit = hasPermission("lecturers.edit");
  const canDelete = hasPermission("lecturers.delete");

  async function loadLecturers() {
    const res = await authFetch("/api/lecturers");
    if (res.ok) setLecturers(await res.json());
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadLecturers();
      setLoading(false);
    })();
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this lecturer?")) return;
    const res = await authFetch(`/api/lecturers/${id}`, { method: "DELETE" });
    if (res.ok) await loadLecturers();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  async function handleToggleActive(l: LecturerRow) {
    const res = await authFetch(`/api/lecturers/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !l.isActive }),
    });
    if (res.ok) await loadLecturers();
    else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  }

  const filtered = lecturers.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const deptNames = (l.departments ?? []).map((d) => d.name).join(" ");
    const courseNames = (l.courses ?? []).map((c) => c.name).join(" ");
    return (
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.degree ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").includes(q) ||
      deptNames.toLowerCase().includes(q) ||
      courseNames.toLowerCase().includes(q)
    );
  });

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: filteredTotal,
    from,
    to,
  } = usePagination(filtered, [search]);

  if (!hasPermission("lecturers.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Lecturers" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view lecturers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Lecturers" />
        {canCreate && (
          <Link
            href="/lecturers/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            <PlusIcon />
            Add Lecturer
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Lecturers
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {filtered.length}
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search lecturers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2 pl-9 pr-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search ? "No lecturers match your search." : "No lecturers yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>#</TableCell>
                <TableCell isHeader>Name</TableCell>
                <TableCell isHeader>Email</TableCell>
                <TableCell isHeader>Departments</TableCell>
                <TableCell isHeader>Courses</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((l, idx) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium text-gray-400 dark:text-gray-500">
                    {globalRowIndex(page, pageSize, idx)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        {(l as LecturerRow & { imageUrl?: string }).imageUrl ? (
                          <Image src={(l as LecturerRow & { imageUrl?: string }).imageUrl!} alt="" width={36} height={36} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-500">
                            {l.name[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <Link href={`/lecturers/${l.id}`} className="font-semibold text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400">
                          {l.name}
                        </Link>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-300">{l.email}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(l.departments ?? []).length === 0 ? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      ) : (
                        (l.departments ?? []).map((d) => (
                          <Badge key={d.id} color="info" size="sm">
                            {d.code}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(l.courses ?? []).length === 0 ? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      ) : (
                        (l.courses ?? []).map((c) => (
                          <span key={c.id} title={c.name} className="inline-block">
                            <Badge color="primary" size="sm">
                              {c.code}
                            </Badge>
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(l)}
                        className="focus:outline-none"
                      >
                        <Badge color={l.isActive ? "success" : "error"} size="sm">
                          {l.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    ) : (
                      <Badge color={l.isActive ? "success" : "error"} size="sm">
                        {l.isActive ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/lecturers/${l.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                        aria-label="View Profile"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {canEdit && (
                        <Link
                          href={`/lecturers/${l.id}/edit`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(l.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
                          aria-label="Delete"
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={filteredTotal}
            from={from}
            to={to}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          </>
        )}
      </div>
    </>
  );
}
