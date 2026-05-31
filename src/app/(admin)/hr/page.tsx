"use client";

import React from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useAuth } from "@/context/AuthContext";
import { UserCircleIcon, ListIcon } from "@/icons";

export default function HRPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission("hr.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Human Resources" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to view HR.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Human Resources" />
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Link
          href="/hr/employees"
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-500/20">
            <UserCircleIcon className="h-7 w-7 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Employees</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage staff and employee records</p>
          </div>
        </Link>
        <Link
          href="/hr/positions"
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-500/20">
            <ListIcon className="h-7 w-7 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Positions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage job titles and positions</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
