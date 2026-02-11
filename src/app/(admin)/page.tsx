import type { Metadata } from "next";
import React from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import RecentStudents from "@/components/dashboard/RecentStudents";
import RecentAttendance from "@/components/dashboard/RecentAttendance";
import StudentsByDepartment from "@/components/dashboard/StudentsByDepartment";
import StudentsByStatus from "@/components/dashboard/StudentsByStatus";

export const metadata: Metadata = {
  title: "Abaarso Tech University | Dashboard",
  description: "Abaarso Tech University Dashboard",
};

export default function DashboardPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Dashboard" />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6">
          <DashboardMetrics />
        </div>

        <div className="col-span-12 lg:col-span-7">
          <RecentStudents />
        </div>

        <div className="col-span-12 lg:col-span-5">
          <RecentAttendance />
        </div>

        <div className="col-span-12 lg:col-span-5">
          <StudentsByDepartment />
        </div>

        <div className="col-span-12 lg:col-span-7">
          <StudentsByStatus />
        </div>
      </div>
    </div>
  );
}
