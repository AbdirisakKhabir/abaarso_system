"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";

type Position = { id: number; name: string; description?: string };
type Employee = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  positionId: number;
  position: { id: number; name: string };
  department: string | null;
  hireDate: string;
  isActive: boolean;
};

export default function HRReportPage() {
  const { hasPermission } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPosition, setFilterPosition] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/hr/employees");
      if (res.ok) setEmployees(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    authFetch("/api/hr/positions").then((r) => {
      if (r.ok) r.json().then((d: Position[]) => setPositions(d));
    });
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredEmployees = filterPosition
    ? employees.filter((e) => e.position?.id === Number(filterPosition))
    : employees;

  const handlePrint = () => window.print();

  if (!hasPermission("hr.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="HR Report" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to view this report.</p>
          <Link href="/reports" className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            ← Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Position", "Department", "Hire Date", "Status"];
    const rows = filteredEmployees.map((e) => [
      e.name,
      e.email,
      e.phone ?? "",
      e.position?.name ?? "",
      e.department ?? "",
      e.hireDate ? new Date(e.hireDate).toLocaleDateString() : "",
      e.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HR_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="HR Report" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <div className="mb-4 print:block hidden print:mb-2">
        <h1 className="text-xl font-bold text-gray-900">Human Resources Report</h1>
        <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="no-print border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Filters</h3>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Position</label>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Positions</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Employees: </span>
            <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{filteredEmployees.length}</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>#</TableCell>
                    <TableCell isHeader>Name</TableCell>
                    <TableCell isHeader>Email</TableCell>
                    <TableCell isHeader>Phone</TableCell>
                    <TableCell isHeader>Position</TableCell>
                    <TableCell isHeader>Department</TableCell>
                    <TableCell isHeader>Hire Date</TableCell>
                    <TableCell isHeader className="text-center">Status</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((e, idx) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-gray-500">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>{e.email}</TableCell>
                      <TableCell>{e.phone ?? "—"}</TableCell>
                      <TableCell>{e.position?.name ?? "—"}</TableCell>
                      <TableCell>{e.department ?? "—"}</TableCell>
                      <TableCell>
                        {e.hireDate ? new Date(e.hireDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge color={e.isActive ? "success" : "error"} size="sm">
                          {e.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
