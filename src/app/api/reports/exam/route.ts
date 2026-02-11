import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      semester?: string;
      year?: number;
    } = {};

    if (departmentId) {
      where.course = { departmentId: Number(departmentId) };
    }

    if (classId) {
      const cls = await prisma.class.findUnique({
        where: { id: Number(classId) },
        select: { courseId: true, semester: true, year: true },
      });
      if (cls) {
        where.courseId = cls.courseId;
        where.semester = cls.semester;
        where.year = cls.year;
        delete where.course;
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

    const byGrade = records.reduce(
      (acc, r) => {
        const g = r.grade || "N/A";
        acc[g] = (acc[g] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const avgGradePoints =
      records.length > 0
        ? records.reduce((s, r) => s + (r.gradePoints || 0), 0) / records.length
        : 0;

    return NextResponse.json({
      records,
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
