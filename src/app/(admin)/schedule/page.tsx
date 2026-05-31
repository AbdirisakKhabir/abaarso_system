"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { PlusIcon, TrashBinIcon, PencilIcon, DownloadIcon } from "@/icons";

// Match ATU schedule sheet: Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday (Friday often OFF)
const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SHIFTS = ["Morning", "Afternoon", "Evening"];
const TIME_PRESETS = [
  "08:00-09:30",
  "09:30-11:00",
  "11:00-12:30",
  "14:00-15:30",
  "15:30-17:00",
  "16:00-19:00",  // 4:00-7:00pm
  "19:00-22:00",  // 7:00-10:00pm
];

type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  departmentId: number;
  department: { id: number; name: string; code: string };
  semester: string;
  year: number;
};

type CourseOption = { id: number; name: string; code: string; departmentId: number };
type LecturerOption = { id: number; name: string; email: string };

type ScheduleSlot = {
  id: string;
  classId: number;
  courseId?: number;
  lecturerId: number;
  dayOfWeek: string;
  shift: string;
  startTime: string;
  endTime: string;
  room: string;
  course?: { code: string; name: string };
  lecturer?: { name: string };
};

/** Format 24h time to 12h am/pm (e.g. "19:00" -> "7:00pm") */
function formatTime12h(time: string): string {
  if (!time || time === "OFF") return time;
  const [h, m] = time.split(":").map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "am" : "pm";
  return `${h12}:${String(m || 0).padStart(2, "0")}${ampm}`;
}

/** Format time range for display (e.g. "7:00-10:00pm") */
function formatTimeRange(start: string, end: string): string {
  if (!start || !end) return "—";
  return `${formatTime12h(start)}-${formatTime12h(end)}`;
}

export default function SchedulePage() {
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [semesters, setSemesters] = useState<{ id: number; name: string }[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [lecturersByCourse, setLecturersByCourse] = useState<Record<number, LecturerOption[]>>({});
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [semester, setSemester] = useState("");
  const [academicYears, setAcademicYears] = useState<{ id: number; startYear: number; endYear: number; name: string }[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const year = academicYears.find((ay) => String(ay.id) === academicYearId)?.endYear ?? new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleSlot>({
    id: "",
    classId: 0,
    courseId: 0,
    lecturerId: 0,
    dayOfWeek: DAYS[0],
    shift: SHIFTS[0],
    startTime: "09:00",
    endTime: "10:30",
    room: "",
  });

  const canCreate = hasPermission("schedule.create");
  const canView = hasPermission("schedule.view");
  const canDelete = hasPermission("schedule.delete");

  const filteredClasses = classes.filter(
    (c) => c.semester === semester && c.year === Number(year) && (!departmentId || c.department?.id === Number(departmentId))
  );
  const selectedClass = filteredClasses.find((c) => c.id === Number(classId));
  const coursesForClass = selectedClass
    ? courses.filter((c) => c.departmentId === selectedClass.departmentId)
    : [];

  const loadSemesters = useCallback(async () => {
    const res = await authFetch("/api/semesters?active=true");
    if (res.ok) {
      const data = await res.json();
      setSemesters(data);
      if (data.length > 0 && !semester) setSemester(data[0].name);
    }
  }, [semester]);

  const loadClasses = useCallback(async () => {
    const res = await authFetch("/api/classes");
    if (res.ok) setClasses(await res.json());
  }, []);

  const loadCourses = useCallback(async () => {
    const res = await authFetch("/api/courses");
    if (res.ok) setCourses(await res.json());
  }, []);

  const loadAcademicYears = useCallback(async () => {
    const res = await authFetch("/api/academic-years");
    if (res.ok) {
      const data = await res.json();
      setAcademicYears(data);
      if (data.length > 0) {
        setAcademicYearId((prev) => {
          if (prev) return prev;
          const current = data.find((ay: { endYear: number }) => ay.endYear >= new Date().getFullYear()) ?? data[data.length - 1];
          return String(current.id);
        });
      }
    }
  }, []);

  const loadLecturersForCourse = useCallback(async (courseId: number) => {
    const res = await authFetch(`/api/lecturers/by-course/${courseId}`);
    if (res.ok) {
      const data = await res.json();
      setLecturersByCourse((prev) => ({ ...prev, [courseId]: data }));
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    if (!semester || !year) return;
    const params = new URLSearchParams({ semester, year: String(year) });
    if (classId) params.set("classId", classId);
    const res = await authFetch(`/api/schedules?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setSlots(
        data.map((s: { id: number; classId: number; courseId?: number; lecturerId: number; dayOfWeek: string; shift: string; startTime: string; endTime: string; room: string | null; course?: { code: string; name: string }; lecturer?: { name: string } }) => ({
          id: `existing-${s.id}`,
          classId: s.classId,
          courseId: s.courseId,
          lecturerId: s.lecturerId,
          dayOfWeek: s.dayOfWeek,
          shift: s.shift,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room ?? "",
          course: s.course ? { code: s.course.code, name: s.course.name } : undefined,
          lecturer: s.lecturer ? { name: s.lecturer.name } : undefined,
        }))
      );
    } else {
      setSlots([]);
    }
  }, [semester, year, classId]);

  const loadDepartments = useCallback(async () => {
    const res = await authFetch("/api/departments");
    if (res.ok) setDepartments(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadDepartments(), loadSemesters(), loadClasses(), loadCourses(), loadAcademicYears()]);
      setLoading(false);
    })();
  }, [loadDepartments, loadSemesters, loadClasses, loadCourses, loadAcademicYears]);

  useEffect(() => {
    if (semester && year) loadSchedules();
  }, [semester, year, loadSchedules]);

  useEffect(() => {
    courses.forEach((c) => loadLecturersForCourse(c.id));
  }, [courses, loadLecturersForCourse]);

  function openAdd() {
    if (!classId) return;
    setModal("add");
    setEditingSlotId(null);
    setForm({
      id: "",
      classId: Number(classId),
      courseId: coursesForClass[0]?.id ?? 0,
      lecturerId: 0,
      dayOfWeek: DAYS[0],
      shift: SHIFTS[0],
      startTime: "09:00",
      endTime: "10:30",
      room: "",
    });
    setError("");
  }

  function openEdit(slot: ScheduleSlot) {
    setModal("edit");
    setEditingSlotId(slot.id);
    setForm({ ...slot });
    setError("");
  }

  function closeModal() {
    setModal(null);
    setEditingSlotId(null);
    setError("");
  }

  function applyTimePreset(preset: string) {
    const [start, end] = preset.split("-");
    setForm((f) => ({ ...f, startTime: start, endTime: end }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const courseId = form.courseId ?? 0;
    const lecturers = lecturersByCourse[courseId] ?? [];
    if (lecturers.length > 0 && !lecturers.some((l) => l.id === form.lecturerId)) {
      setError("Select a lecturer assigned to this course. Assign in Lecturers page first.");
      return;
    }
    if (!form.classId || !courseId || !form.lecturerId || !form.startTime || !form.endTime) {
      setError("Class, Course, Lecturer, and Time are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        classId: form.classId,
        courseId,
        lecturerId: form.lecturerId,
        dayOfWeek: form.dayOfWeek,
        shift: form.shift,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room || undefined,
      };

      if (modal === "add") {
        const res = await authFetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: [{ ...payload, semester, year: Number(year) }] }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || data.details?.join(". ") || "Failed to save");
          return;
        }
      } else if (modal === "edit" && form.id.startsWith("existing-")) {
        const patchPayload = { ...payload };
        if (form.courseId) patchPayload.courseId = form.courseId;
        const res = await authFetch(`/api/schedules/${form.id.replace("existing-", "")}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to update");
          return;
        }
      }
      await loadSchedules();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slot: ScheduleSlot) {
    if (!slot.id.startsWith("existing-")) return;
    if (!confirm("Delete this schedule slot?")) return;
    const res = await authFetch(`/api/schedules/${slot.id.replace("existing-", "")}`, { method: "DELETE" });
    if (res.ok) await loadSchedules();
  }

  type ScheduleTableRow =
    | { kind: "off"; day: string; rowNum: number }
    | { kind: "slot"; day: string; rowNum: number; slot: ScheduleSlot };

  const scheduleTableRows = useMemo((): ScheduleTableRow[] => {
    if (!classId) return [];
    const classSlots = slots.filter((s) => s.classId === Number(classId));
    const slotsByDay = DAYS.map((day) => classSlots.filter((s) => s.dayOfWeek === day));
    let rowNum = 0;
    const out: ScheduleTableRow[] = [];
    DAYS.forEach((day, dayIdx) => {
      const daySlots = slotsByDay[dayIdx];
      if (daySlots.length === 0) {
        rowNum++;
        out.push({ kind: "off", day, rowNum });
      } else {
        daySlots.forEach((slot) => {
          rowNum++;
          out.push({ kind: "slot", day, rowNum, slot });
        });
      }
    });
    return out;
  }, [classId, slots]);

  const {
    paginatedItems: paginatedScheduleRows,
    page: schedulePage,
    setPage: setSchedulePage,
    pageSize: schedulePageSize,
    setPageSize: setSchedulePageSize,
    totalPages: scheduleTotalPages,
    total: scheduleRowsTotal,
    from: scheduleFrom,
    to: scheduleTo,
  } = usePagination(scheduleTableRows, [classId, semester, year]);

  function handlePrintSchedules() {
    const targetClasses = classId ? filteredClasses.filter((c) => c.id === Number(classId)) : filteredClasses;
    const sheetsHtml = targetClasses
      .map((cls) => {
        const classSlots = slots.filter((s) => s.classId === cls.id);
        const slotsByDay = DAYS.map((day) => classSlots.filter((s) => s.dayOfWeek === day));
        let rowNum = 0;
        const rows = DAYS.flatMap((day, dayIdx) => {
          const daySlots = slotsByDay[dayIdx];
          if (daySlots.length === 0) {
            rowNum++;
            return `<tr><td class="tc">${rowNum}</td><td>${day}</td><td>OFF</td><td>OFF</td><td>OFF</td><td>OFF</td></tr>`;
          }
          return daySlots.map((s) => {
            rowNum++;
            const lecturer = lecturersByCourse[(s as ScheduleSlot).courseId ?? 0]?.find((l) => l.id === s.lecturerId);
            const code = s.course?.code ?? "—";
            const name = s.course?.name ?? "—";
            return `<tr><td class="tc">${rowNum}</td><td>${day}</td><td>${formatTimeRange(s.startTime, s.endTime)}</td><td>${code}</td><td>${name}</td><td>${lecturer?.name ?? "—"}</td></tr>`;
          });
        }).join("");
        const deptName = cls.department?.name ?? "";
        const deptCode = cls.department?.code ?? "";
        return `
          <div class="print-sheet">
            <div class="sheet-header">
              <h1>ABAARSO TECH UNIVERSITY BERBERA</h1>
              <p class="sub">ACADEMIC OFFICE</p>
              <h2>SCHEDULE</h2>
              <p class="meta">Department: ${deptCode} - ${deptName} | Semester: ${cls.semester} ${cls.year}</p>
              <p class="meta">Starting Date: 1st November, ${year} — Ending Date: 5th February, ${Number(year) + 1}</p>
            </div>
            <table class="sheet-table">
              <thead><tr><th>S/No</th><th>DAY</th><th>TIME</th><th>C. CODE</th><th>COURSE</th><th>LECTURER</th></tr></thead>
              <tbody>${rows || "<tr><td colspan='6'>No schedule slots</td></tr>"}</tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Schedule - ${semester} ${year}</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; color: #111; }
            .print-sheet { page-break-after: always; margin-bottom: 24px; }
            .print-sheet:last-child { page-break-after: auto; }
            .sheet-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; }
            .sheet-header h1 { margin: 0; font-size: 20px; }
            .sheet-header .sub { margin: 4px 0 0; font-size: 14px; color: #555; }
            .sheet-header h2 { margin: 16px 0 8px; font-size: 18px; }
            .sheet-header .meta { margin: 4px 0; font-size: 13px; color: #555; }
            .sheet-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .sheet-table th, .sheet-table td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
            .sheet-table td.tc { text-align: center; }
            .sheet-table th { background: #f5f5f5; font-weight: 600; }
            @media print { body { padding: 0; } .print-sheet { margin-bottom: 0; } }
          </style>
        </head>
        <body>${sheetsHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  const lecturersForForm = lecturersByCourse[form.courseId ?? 0] ?? [];

  const lecturerMismatch = form.lecturerId > 0 && lecturersForForm.length > 0 && !lecturersForForm.some((l) => l.id === form.lecturerId);

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Schedule" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You do not have permission to view the schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Semester Schedule" />
      </div>

      {/* Filters: Department, Class, Semester, Year - match ATU sheet */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
          <select
            value={departmentId}
            onChange={(e) => { setDepartmentId(e.target.value); setClassId(""); }}
            disabled={loading}
            className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[160px] rounded-lg border border-gray-200 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={loading}
            className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <option value="">All Classes</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.department?.code ?? ""})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={loading}
            className="h-10 rounded-lg border border-gray-200 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Academic Year</label>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            disabled={loading}
            className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <option value="">Select year</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>{ay.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            startIcon={<DownloadIcon />}
            onClick={handlePrintSchedules}
            size="sm"
            disabled={loading || filteredClasses.length === 0}
          >
            Print Schedule
          </Button>
          {canCreate && (
            <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm" disabled={loading || !classId || filteredClasses.length === 0}>
              Add Slot
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Create classes first in the Classes page.</p>
          </div>
        ) : !classId ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Select a Department and Class to view or edit the schedule.</p>
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader className="w-14">S/No</TableCell>
                <TableCell isHeader>Day</TableCell>
                <TableCell isHeader>Time</TableCell>
                <TableCell isHeader>C. Code</TableCell>
                <TableCell isHeader>Course</TableCell>
                <TableCell isHeader>Lecturer</TableCell>
                {canCreate && <TableCell isHeader className="text-right">Actions</TableCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedScheduleRows.map((row) =>
                row.kind === "off" ? (
                  <TableRow key={`off-${row.day}-${row.rowNum}`}>
                    <TableCell className="text-center font-medium">{row.rowNum}</TableCell>
                    <TableCell>{row.day}</TableCell>
                    <TableCell>OFF</TableCell>
                    <TableCell>OFF</TableCell>
                    <TableCell>OFF</TableCell>
                    <TableCell>OFF</TableCell>
                    {canCreate && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setForm({
                              id: "",
                              classId: Number(classId),
                              courseId: coursesForClass[0]?.id ?? 0,
                              lecturerId: 0,
                              dayOfWeek: row.day,
                              shift: SHIFTS[0],
                              startTime: "09:00",
                              endTime: "10:30",
                              room: "",
                            });
                            setModal("add");
                            setEditingSlotId(null);
                            setError("");
                          }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ) : (
                  (() => {
                    const slot = row.slot;
                    const lecturer =
                      slot.lecturer?.name ??
                      lecturersByCourse[(slot as ScheduleSlot).courseId ?? 0]?.find((l) => l.id === slot.lecturerId)?.name;
                    return (
                      <TableRow key={slot.id}>
                        <TableCell className="text-center font-medium">{row.rowNum}</TableCell>
                        <TableCell>{row.day}</TableCell>
                        <TableCell>{formatTimeRange(slot.startTime, slot.endTime)}</TableCell>
                        <TableCell>{slot.course?.code ?? "—"}</TableCell>
                        <TableCell>{slot.course?.name ?? "—"}</TableCell>
                        <TableCell>{lecturer ?? "—"}</TableCell>
                        {canCreate && (
                          <TableCell className="text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(slot)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                                aria-label="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              {canDelete && slot.id.startsWith("existing-") && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(slot)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
                                  aria-label="Delete"
                                >
                                  <TrashBinIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })()
                )
              )}
            </TableBody>
          </Table>
          <TablePagination
            page={schedulePage}
            totalPages={scheduleTotalPages}
            total={scheduleRowsTotal}
            from={scheduleFrom}
            to={scheduleTo}
            pageSize={schedulePageSize}
            onPageChange={setSchedulePage}
            onPageSizeChange={setSchedulePageSize}
          />
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {modal === "add" ? "Add Schedule Slot" : "Edit Schedule Slot"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              {error && (
                <div className="mb-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {classId && selectedClass && (
                  <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                    Class: <strong>{selectedClass.name}</strong> ({selectedClass.department?.code ?? ""})
                  </div>
                )}
                {coursesForClass.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Course</label>
                    <select
                      value={form.courseId ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, courseId: Number(e.target.value), lecturerId: 0 }))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                      required
                    >
                      <option value={0}>Select course</option>
                      {coursesForClass.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {!classId && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
                    <select
                      value={form.classId}
                      onChange={(e) => setForm((f) => ({ ...f, classId: Number(e.target.value), lecturerId: 0 }))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                      required
                    >
                      <option value={0}>Select class</option>
                      {filteredClasses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.department?.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Lecturer</label>
                  <select
                    value={form.lecturerId}
                    onChange={(e) => setForm((f) => ({ ...f, lecturerId: Number(e.target.value) }))}
                    className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 dark:bg-gray-800/50 ${
                      lecturerMismatch ? "border-error-500" : "border-gray-200 dark:border-gray-700 focus:border-brand-500"
                    }`}
                    required
                  >
                    <option value={0}>Select lecturer</option>
                    {lecturersForForm.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                    {(form.courseId ?? 0) > 0 && lecturersForForm.length === 0 && (
                      <option value={0} disabled>No lecturers for this course</option>
                    )}
                  </select>
                  {lecturerMismatch && (
                    <p className="mt-1 text-xs text-error-600 dark:text-error-400">Assign lecturer to this course in Lecturers page.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Day</label>
                    <select
                      value={form.dayOfWeek}
                      onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Shift</label>
                    <select
                      value={form.shift}
                      onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {TIME_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyTimePreset(p)}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs transition-colors hover:bg-brand-50 hover:border-brand-300 dark:border-gray-700 dark:hover:bg-brand-500/10"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="h-10 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                    />
                    <span className="flex items-center text-gray-400">–</span>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="h-10 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Room (optional)</label>
                  <input
                    type="text"
                    value={form.room}
                    onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                    placeholder="e.g. Room 201"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800/50"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal} size="sm">Cancel</Button>
                <Button type="submit" disabled={saving || lecturerMismatch} size="sm">
                  {saving ? "Saving..." : modal === "add" ? "Add Slot" : "Update"}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}
    </div>
  );
}
