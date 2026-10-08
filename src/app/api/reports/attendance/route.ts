import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program")) as "Bachelor" | "Masters";
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const courseId = searchParams.get("courseId");
    const studentId = searchParams.get("studentId");
    const search = searchParams.get("search")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let matchedStudentIds: number[] | null = null;
    if (studentId && Number.isInteger(Number(studentId))) {
      matchedStudentIds = [Number(studentId)];
    } else if (search) {
      const matched = await prisma.student.findMany({
        where: {
          status: { in: ["Admitted", "Graduated"] },
          program,
          OR: [
            { studentId: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      matchedStudentIds = matched.map((s) => s.id);
      if (matchedStudentIds.length === 0) {
        return NextResponse.json({
          sessions: [],
          summary: {
            totalSessions: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalExcused: 0,
          },
          courseSessions: [],
        });
      }
    }

    const where: {
      classId?: number;
      courseId?: number;
      class?: { departmentId?: number; program?: "Bachelor" | "Masters" };
      date?: { gte?: Date; lte?: Date };
      records?: { some: { studentId: number | { in: number[] } } };
    } = {
      class: { program },
    };

    if (departmentId) {
      where.class = { ...where.class, departmentId: Number(departmentId) };
    }
    if (classId) {
      where.classId = Number(classId);
    }
    if (courseId) {
      where.courseId = Number(courseId);
    }
    if (matchedStudentIds) {
      where.records = {
        some: {
          studentId:
            matchedStudentIds.length === 1
              ? matchedStudentIds[0]
              : { in: matchedStudentIds },
        },
      };
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
        takenBy: { select: { id: true, name: true, email: true } },
        // With a student filter, count only that student's own records (not the whole class)
        records: {
          ...(matchedStudentIds ? { where: { studentId: { in: matchedStudentIds } } } : {}),
          select: { status: true },
        },
      },
      orderBy: [{ date: "desc" }, { shift: "asc" }],
    });

    const summary = {
      totalSessions: sessions.length,
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalExcused: 0,
    };

    const courseMap = new Map<
      number,
      { courseId: number; code: string; name: string; sessionCount: number }
    >();

    const enriched = sessions.map((s) => {
      const present = s.records.filter((r) => r.status === "Present").length;
      const absent = s.records.filter((r) => r.status === "Absent").length;
      const late = s.records.filter((r) => r.status === "Late").length;
      const excused = s.records.filter((r) => r.status === "Excused").length;
      summary.totalPresent += present;
      summary.totalAbsent += absent;
      summary.totalLate += late;
      summary.totalExcused += excused;

      if (s.course) {
        const existing = courseMap.get(s.course.id);
        if (existing) existing.sessionCount += 1;
        else {
          courseMap.set(s.course.id, {
            courseId: s.course.id,
            code: s.course.code,
            name: s.course.name,
            sessionCount: 1,
          });
        }
      }

      return {
        id: s.id,
        class: s.class,
        course: s.course,
        date: s.date,
        shift: s.shift,
        takenBy: s.takenBy,
        takenAt: s.takenAt,
        present,
        absent,
        late,
        excused,
        total: s.records.length,
      };
    });

    const courseSessions = [...courseMap.values()].sort(
      (a, b) => b.sessionCount - a.sessionCount || a.code.localeCompare(b.code)
    );

    return NextResponse.json({
      sessions: enriched,
      summary,
      courseSessions,
      filteredToStudents: Boolean(matchedStudentIds),
    });
  } catch (e) {
    console.error("Attendance report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
