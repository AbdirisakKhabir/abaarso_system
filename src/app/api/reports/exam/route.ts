import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");

    let where: {
      course?: { departmentId?: number };
      courseId?: number;
      student?: { classId: number };
      semester?: string;
      year?: number;
    } = {};

    if (departmentId) {
      where.course = { departmentId: Number(departmentId) };
    }

    if (classId) {
      const cls = await prisma.class.findUnique({
        where: { id: Number(classId) },
        select: { departmentId: true, semester: true, year: true },
      });
      if (cls) {
        where.student = { classId: Number(classId) };
        where.course = { departmentId: cls.departmentId };
        where.semester = cls.semester;
        where.year = cls.year;
        delete where.courseId;
      }
    } else {
      if (semester && semester !== "all") where.semester = semester;
      if (year) where.year = Number(year);
    }

    const records = await prisma.examRecord.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            creditHours: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { student: { firstName: "asc" } }],
    });

    // When filtering by class, enrich with per-course attendance (sessions for that exam's course)
    let enrichedRecords = records;
    if (classId) {
      const cls = await prisma.class.findUnique({
        where: { id: Number(classId) },
        select: { semester: true, year: true },
      });
      const { start, end } = cls
        ? getSemesterDateRange(cls.semester, cls.year)
        : { start: new Date(0), end: new Date() };

      const studentIds = [...new Set(records.map((r) => r.student.id))];
      const courseIds = [...new Set(records.map((r) => r.courseId))];

      const sessionsByCourse = new Map<number, number[]>();
      for (const cid of courseIds) {
        const ids = (
          await prisma.attendanceSession.findMany({
            where: {
              classId: Number(classId),
              courseId: cid,
              date: { gte: start, lte: end },
            },
            select: { id: true },
          })
        ).map((s) => s.id);
        sessionsByCourse.set(cid, ids);
      }

      const attendanceByCourseStudent = new Map<
        string,
        { present: number; excused: number }
      >();
      for (const cid of courseIds) {
        const sessionIds = sessionsByCourse.get(cid) ?? [];
        if (sessionIds.length === 0) continue;
        const att = await prisma.attendanceRecord.findMany({
          where: {
            sessionId: { in: sessionIds },
            studentId: { in: studentIds },
          },
          select: { studentId: true, status: true },
        });
        for (const row of att) {
          const k = `${cid}:${row.studentId}`;
          if (!attendanceByCourseStudent.has(k)) {
            attendanceByCourseStudent.set(k, { present: 0, excused: 0 });
          }
          const agg = attendanceByCourseStudent.get(k)!;
          if (row.status === "Present") agg.present++;
          else if (row.status === "Excused") agg.excused++;
        }
      }

      enrichedRecords = records.map((r) => {
        const sessionIds = sessionsByCourse.get(r.courseId) ?? [];
        const totalSessions = sessionIds.length;
        const agg =
          attendanceByCourseStudent.get(`${r.courseId}:${r.student.id}`) ?? {
            present: 0,
            excused: 0,
          };
        const presentPlusExcused = agg.present + agg.excused;
        return {
          ...r,
          attendancePercent: computeAttendancePercent(presentPlusExcused, totalSessions),
          attendanceMarks: computeAttendanceMarks(presentPlusExcused, totalSessions),
          totalSessions,
        };
      });
    }

    const byGrade = enrichedRecords.reduce(
      (acc, r) => {
        const g = r.grade || "N/A";
        acc[g] = (acc[g] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const avgGradePoints =
      enrichedRecords.length > 0
        ? enrichedRecords.reduce((s, r) => s + (r.gradePoints || 0), 0) / enrichedRecords.length
        : 0;

    return NextResponse.json({
      records: enrichedRecords,
      summary: {
        total: records.length,
        byGrade,
        avgGradePoints: Math.round(avgGradePoints * 100) / 100,
      },
    });
  } catch (e) {
    console.error("Exam report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
