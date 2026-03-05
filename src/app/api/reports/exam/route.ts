import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";

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

    // When filtering by class, enrich records with attendance (Present+Excused = 10% of exam)
    let enrichedRecords = records;
    if (classId) {
      const sessionIds = (
        await prisma.attendanceSession.findMany({
          where: { classId: Number(classId) },
          select: { id: true },
        })
      ).map((s) => s.id);
      const totalSessions = sessionIds.length;
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          sessionId: { in: sessionIds },
          studentId: { in: [...new Set(records.map((r) => r.student.id))] },
        },
        select: { studentId: true, status: true },
      });
      const byStudent = new Map<
        number,
        { present: number; excused: number }
      >();
      for (const r of attendanceRecords) {
        if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, { present: 0, excused: 0 });
        const agg = byStudent.get(r.studentId)!;
        if (r.status === "Present") agg.present++;
        else if (r.status === "Excused") agg.excused++;
      }
      enrichedRecords = records.map((r) => {
        const agg = byStudent.get(r.student.id) ?? { present: 0, excused: 0 };
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
