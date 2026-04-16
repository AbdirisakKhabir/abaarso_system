import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";

/**
 * GET /api/reports/attendance-by-student?classId=X&courseId=Y&semester=&year=
 * Per-course attendance for students in the class (sessions filtered by course).
 * courseId is required — must match a course on the class schedule.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const courseIdParam = searchParams.get("courseId");
    const semesterParam = searchParams.get("semester");
    const yearParam = searchParams.get("year");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required for attendance-by-student report" },
        { status: 400 }
      );
    }
    if (!courseIdParam || !Number.isInteger(Number(courseIdParam))) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }
    const filterCourseId = Number(courseIdParam);

    const cls = await prisma.class.findUnique({
      where: { id: Number(classId) },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const semester = semesterParam ?? cls.semester;
    const year = yearParam ? Number(yearParam) : cls.year;
    const { start, end } = getSemesterDateRange(semester, year);

    const scheduleMeta = await prisma.classSchedule.findFirst({
      where: {
        classId: Number(classId),
        courseId: filterCourseId,
        semester: cls.semester,
        year: cls.year,
      },
      include: {
        course: { select: { code: true, name: true } },
        lecturer: { select: { name: true } },
      },
    });

    if (!scheduleMeta) {
      return NextResponse.json(
        {
          error:
            "This course is not on the schedule for this class in this semester, or it was removed.",
        },
        { status: 400 }
      );
    }

    /** Up to 12 sessions map to W1–W6 (first half) and W1–W6 (second half), ordered by date. */
    const SHEET_SLOTS = 12;

    const sessionsOrdered = await prisma.attendanceSession.findMany({
      where: {
        classId: Number(classId),
        courseId: filterCourseId,
        date: { gte: start, lte: end },
      },
      orderBy: [{ date: "asc" }, { shift: "asc" }],
      select: { id: true },
    });
    const sessionIds = sessionsOrdered.map((s) => s.id);
    const totalSessions = sessionIds.length;

    const slotSessionIds: (number | null)[] = Array.from(
      { length: SHEET_SLOTS },
      (_, i) => sessionsOrdered[i]?.id ?? null
    );

    // Get all students in this class (from Student.classId)
    const students = await prisma.student.findMany({
      where: { classId: Number(classId), status: "Admitted" },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    if (students.length === 0) {
      return NextResponse.json({
        class: cls,
        students: [],
        totalSessions: 0,
        sheet: {
          slotSessionIds: Array.from({ length: SHEET_SLOTS }, () => null),
          facultyLabel: `FACULTY OF ${cls.department.code} — ${cls.department.name}`,
          courseLabel: `${scheduleMeta.course.code} — ${scheduleMeta.course.name}`,
          lecturerName: scheduleMeta.lecturer?.name ?? null,
        },
      });
    }

    // Get all attendance records for these students in these sessions
    const records = await prisma.attendanceRecord.findMany({
      where: {
        sessionId: { in: sessionIds },
        studentId: { in: students.map((s) => s.id) },
      },
      select: { sessionId: true, studentId: true, status: true },
    });

    // Aggregate by student
    const byStudent = new Map<
      number,
      { present: number; absent: number; late: number; excused: number }
    >();
    for (const s of students) {
      byStudent.set(s.id, { present: 0, absent: 0, late: 0, excused: 0 });
    }
    for (const r of records) {
      const agg = byStudent.get(r.studentId);
      if (!agg) continue;
      if (r.status === "Present") agg.present++;
      else if (r.status === "Absent") agg.absent++;
      else if (r.status === "Late") agg.late++;
      else if (r.status === "Excused") agg.excused++;
    }

    const recordMap = new Map<string, string>();
    for (const r of records) {
      recordMap.set(`${r.studentId}:${r.sessionId}`, r.status);
    }

    function halfSlotTint(
      slots: (boolean | null)[],
      start: number
    ): "none" | "warn" {
      let denom = 0;
      let num = 0;
      for (let i = start; i < start + 6; i++) {
        if (slotSessionIds[i] == null) continue;
        denom++;
        if (slots[i] === true) num++;
      }
      if (denom === 0) return "none";
      return num / denom < 0.5 ? "warn" : "none";
    }

    const result = students.map((s) => {
      const agg = byStudent.get(s.id) ?? {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      const presentPlusExcused = agg.present + agg.excused;
      const attendancePercent = computeAttendancePercent(
        presentPlusExcused,
        totalSessions
      );
      const attendanceMarks = computeAttendanceMarks(
        presentPlusExcused,
        totalSessions
      );

      const slots: (boolean | null)[] = Array.from(
        { length: SHEET_SLOTS },
        (_, i) => {
          const sid = slotSessionIds[i];
          if (sid == null) return null;
          const st = recordMap.get(`${s.id}:${sid}`);
          if (st === undefined) return false;
          return st === "Present" || st === "Excused";
        }
      );
      const totalChecked = slots.filter((v) => v === true).length;
      const sheetMarksRaw = (totalChecked / SHEET_SLOTS) * 10;
      const sheetMarksRounded = Math.round(sheetMarksRaw * 10) / 10;

      return {
        studentId: s.id,
        studentIdStr: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        present: agg.present,
        absent: agg.absent,
        late: agg.late,
        excused: agg.excused,
        totalSessions,
        attendancePercent,
        attendanceMarks,
        slots,
        totalChecked,
        sheetMarksRaw,
        sheetMarksRounded,
        firstHalfTint: halfSlotTint(slots, 0),
        secondHalfTint: halfSlotTint(slots, 6),
        rowDanger: attendancePercent < 35,
      };
    });

    return NextResponse.json({
      class: cls,
      semester,
      year,
      students: result,
      totalSessions,
      sheet: {
        slotSessionIds,
        facultyLabel: `FACULTY OF ${cls.department.code} — ${cls.department.name}`,
        courseLabel: `${scheduleMeta.course.code} — ${scheduleMeta.course.name}`,
        lecturerName: scheduleMeta.lecturer?.name ?? null,
        courseId: filterCourseId,
      },
    });
  } catch (e) {
    console.error("Attendance-by-student report error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
