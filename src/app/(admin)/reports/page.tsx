import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { PageIcon, PieChartIcon, ListIcon, DollarLineIcon } from "@/icons";

export const metadata: Metadata = {
  title: "Reports | Abaarso Tech University",
  description: "Abaarso Tech University reports",
};

const reportLinks = [
  { name: "Admission Report", path: "/reports/admission", icon: PageIcon, description: "View students by department and class with status breakdown" },
  { name: "Attendance Report", path: "/reports/attendance", icon: PieChartIcon, description: "View attendance sessions with present/absent/late/excused counts" },
  { name: "Attendance & Exam Report", path: "/reports/attendance-exam", icon: PieChartIcon, description: "View attendance % and exam results by class with attendance as 10% of grade" },
  { name: "Exam Report", path: "/reports/exam", icon: ListIcon, description: "View exam records by department and class with grade distribution" },
  { name: "Lecturer Report", path: "/reports/lecturers", icon: PageIcon, description: "View lecturers by department with courses and contact info" },
  { name: "HR Report", path: "/reports/hr", icon: PageIcon, description: "View employees by position with hire dates and status" },
  { name: "Student Transactions", path: "/reports/student-transactions", icon: DollarLineIcon, description: "View student payment status by department and class" },
  { name: "Class Revenue", path: "/reports/class-revenue", icon: DollarLineIcon, description: "View class revenue with paid/unpaid counts" },
  { name: "Unpaid Students", path: "/reports/unpaid-students", icon: DollarLineIcon, description: "Generate list of students who have not paid for a specific semester and class" },
  { name: "Paid Students", path: "/reports/paid-students", icon: DollarLineIcon, description: "Generate list of students who have paid (or have no tuition due) for a semester and class" },
];

export default function ReportsIndexPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Reports" />
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Select a report to view and print. Each report can be printed separately.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportLinks.map((report) => (
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
