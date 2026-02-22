import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { DollarLineIcon, ListIcon } from "@/icons";

export const metadata: Metadata = {
  title: "Payment Reports | Abaarso Tech University",
  description: "Student transactions and class revenue reports",
};

const paymentReportLinks = [
  { name: "Student Transactions", path: "/reports/student-transactions", icon: ListIcon, description: "View student payment status by department and class" },
  { name: "Class Revenue", path: "/reports/class-revenue", icon: DollarLineIcon, description: "View class revenue with paid/unpaid counts" },
  { name: "Unpaid Students", path: "/reports/unpaid-students", icon: DollarLineIcon, description: "Generate list of students who have not paid for a specific semester and class" },
];

export default function PaymentReportsIndexPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Payment Reports" />
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Select a payment report to view and print.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paymentReportLinks.map((report) => (
          <Link key={report.path} href={report.path}>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                <report.icon className="size-6 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">{report.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
              <p className="mt-3 text-sm font-medium text-brand-600 dark:text-brand-400">View Report →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
