import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { BoltIcon, DollarLineIcon, ListIcon } from "@/icons";

export const metadata: Metadata = {
  title: "Finance Reports | Abaarso Tech University",
  description: "Finance, payment, bank, and treasury reports",
};

const paymentReportLinks = [
  { name: "Student Transactions", path: "/reports/student-transactions", icon: ListIcon, description: "View student payment status by department and class" },
  { name: "Class Revenue", path: "/reports/class-revenue", icon: DollarLineIcon, description: "View class revenue with paid/unpaid counts" },
  { name: "Unpaid Students", path: "/reports/unpaid-students", icon: DollarLineIcon, description: "Generate list of students who have not paid for a specific semester and class" },
  { name: "Bank Balances", path: "/reports/bank-balances", icon: DollarLineIcon, description: "Current balance of each bank account" },
  { name: "Bank Transactions", path: "/reports/bank-transactions", icon: ListIcon, description: "Deposits, withdrawals, and transfers by bank and date" },
  { name: "Transaction History", path: "/reports/transaction-history", icon: ListIcon, description: "Unified log of all financial transactions (auto-created)" },
  { name: "Treasury Summary", path: "/reports/treasury", icon: DollarLineIcon, description: "Overview of bank balance, receivables, revenue, and withdrawals" },
  { name: "Daily Revenue", path: "/reports/daily-revenue", icon: DollarLineIcon, description: "Revenue collected per day within a date range" },
  { name: "Activity Log Report", path: "/reports/activity-log", icon: BoltIcon, description: "System audit trail by date range; requires Settings permission" },
];

export default function PaymentReportsIndexPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Finance Reports" />
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Select a finance report to view, export, and print.
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
