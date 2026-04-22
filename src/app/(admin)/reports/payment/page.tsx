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
  { name: "Student Transactions", path: "/reports/student-transactions", icon: ListIcon, description: "Student payment status by department and class" },
  { name: "Class Revenue", path: "/reports/class-revenue", icon: DollarLineIcon, description: "Class revenue with paid and unpaid counts" },
  { name: "Unpaid Students", path: "/reports/unpaid-students", icon: DollarLineIcon, description: "Students not paid for a semester and class" },
  { name: "Bank Balances", path: "/reports/bank-balances", icon: DollarLineIcon, description: "Balance per bank account" },
  { name: "Bank Transactions", path: "/reports/bank-transactions", icon: ListIcon, description: "Deposits, withdrawals, and transfers by bank and date" },
  { name: "Transaction History", path: "/reports/transaction-history", icon: ListIcon, description: "Unified ledger of financial transactions" },
  { name: "Treasury Summary", path: "/reports/treasury", icon: DollarLineIcon, description: "Bank balance, receivables, revenue, and withdrawals" },
  { name: "Daily Revenue", path: "/reports/daily-revenue", icon: DollarLineIcon, description: "Revenue per day in a date range" },
  { name: "Expense Report", path: "/reports/expenses", icon: ListIcon, description: "Approved and pending expenses by year" },
  { name: "Income Statement", path: "/reports/income-statement", icon: DollarLineIcon, description: "Revenue, expenses, and net income for a year" },
  { name: "Activity Log Report", path: "/reports/activity-log", icon: BoltIcon, description: "Audit trail by date range (requires Settings access)" },
];

export default function PaymentReportsIndexPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Finance Reports" />
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Open a report for tables, charts, export, and print.
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/5">
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Report</th>
              <th className="hidden px-4 py-3 font-semibold text-gray-900 dark:text-white md:table-cell">Description</th>
              <th className="w-28 px-4 py-3 font-semibold text-gray-900 dark:text-white" />
            </tr>
          </thead>
          <tbody>
            {paymentReportLinks.map((report) => (
              <tr
                key={report.path}
                className="border-b border-gray-100 last:border-0 dark:border-gray-800"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <report.icon className="size-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
                    <span className="font-medium text-gray-900 dark:text-white">{report.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 md:hidden dark:text-gray-400">{report.description}</p>
                </td>
                <td className="hidden px-4 py-3 text-gray-600 md:table-cell dark:text-gray-400">
                  {report.description}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={report.path}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
