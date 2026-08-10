import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { genderFilterValues, normalizeGender } from "@/lib/gender";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";

type GenderCounts = {
  Male: number;
  Female: number;
  Unspecified: number;
  total: number;
};

function countByGender(students: { gender: string | null }[]): GenderCounts {
  const counts: GenderCounts = { Male: 0, Female: 0, Unspecified: 0, total: students.length };
  for (const s of students) {
    const normalized = normalizeGender(s.gender);
    if (normalized === "Male") counts.Male += 1;
    else if (normalized === "Female") counts.Female += 1;
    else counts.Unspecified += 1;
  }
  return counts;
}

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
    const status = searchParams.get("status");
    const gender = searchParams.get("gender");
    const semester = searchParams.get("semester")?.trim() || "";
    const yearRaw = searchParams.get("year")?.trim() || "";
    const year = yearRaw ? Number(yearRaw) : null;

    if (yearRaw && (!Number.isInteger(year) || (year as number) < 2000)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const where: Prisma.StudentWhereInput = { program };

    if (departmentId) {
      where.departmentId = Number(departmentId);
    }

    if (classId) {
      where.classId = Number(classId);
    } else if (semester || year != null) {
      // University-wide (or department) students whose current class matches term
      const classFilter: Prisma.ClassWhereInput = { program };
      if (semester) classFilter.semester = semester;
      if (year != null) classFilter.year = year;
      if (departmentId) classFilter.departmentId = Number(departmentId);
      where.class = { is: classFilter };
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (gender && gender !== "all") {
      if (gender === "Male" || gender === "Female") {
        where.gender = { in: genderFilterValues(gender) };
      }
    }

    // If classId + semester/year are both set, ensure the class matches the term
    if (classId && (semester || year != null)) {
      const cls = await prisma.class.findUnique({
        where: { id: Number(classId) },
        select: { semester: true, year: true, program: true },
      });
      if (!cls || cls.program !== program) {
        return NextResponse.json({
          students: [],
          summary: {
            total: 0,
            byStatus: {},
            byGender: { Male: 0, Female: 0, Unspecified: 0, total: 0 },
          },
          genderBreakdown: null,
        });
      }
      if (semester && cls.semester !== semester) {
        return NextResponse.json({
          students: [],
          summary: {
            total: 0,
            byStatus: {},
            byGender: { Male: 0, Female: 0, Unspecified: 0, total: 0 },
          },
          genderBreakdown: null,
        });
      }
      if (year != null && cls.year !== year) {
        return NextResponse.json({
          students: [],
          summary: {
            total: 0,
            byStatus: {},
            byGender: { Male: 0, Female: 0, Unspecified: 0, total: 0 },
          },
          genderBreakdown: null,
        });
      }
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, semester: true, year: true } },
      },
      orderBy: [{ admissionDate: "desc" }, { createdAt: "desc" }],
    });

    const byStatus = students.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byGender = countByGender(students);

    let genderBreakdown: {
      scope: "class" | "department" | "semester";
      byClass: Array<{
        classId: number;
        className: string;
        semester: string;
        year: number;
        Male: number;
        Female: number;
        Unspecified: number;
        total: number;
      }>;
      department?: { id: number; name: string; code: string };
    } | null = null;

    if (classId) {
      const cls =
        students[0]?.class ??
        (await prisma.class.findUnique({
          where: { id: Number(classId) },
          select: { id: true, name: true, semester: true, year: true },
        }));
      const counts = countByGender(students);
      genderBreakdown = {
        scope: "class",
        byClass: cls
          ? [
              {
                classId: cls.id,
                className: cls.name,
                semester: cls.semester,
                year: cls.year,
                Male: counts.Male,
                Female: counts.Female,
                Unspecified: counts.Unspecified,
                total: counts.total,
              },
            ]
          : [],
      };
    } else if (departmentId || semester || year != null) {
      const classWhere: Prisma.ClassWhereInput = { program };
      if (departmentId) classWhere.departmentId = Number(departmentId);
      if (semester) classWhere.semester = semester;
      if (year != null) classWhere.year = year;

      const classesInScope = await prisma.class.findMany({
        where: classWhere,
        select: { id: true, name: true, semester: true, year: true },
        orderBy: [{ year: "desc" }, { name: "asc" }],
      });

      const byClassId = new Map<number, { gender: string | null }[]>();
      for (const s of students) {
        if (s.classId == null) continue;
        const list = byClassId.get(s.classId) ?? [];
        list.push({ gender: s.gender });
        byClassId.set(s.classId, list);
      }

      const byClass = classesInScope
        .map((cls) => {
          const classStudents = byClassId.get(cls.id) ?? [];
          const counts = countByGender(classStudents);
          return {
            classId: cls.id,
            className: cls.name,
            semester: cls.semester,
            year: cls.year,
            Male: counts.Male,
            Female: counts.Female,
            Unspecified: counts.Unspecified,
            total: counts.total,
          };
        })
        .filter((row) => row.total > 0);

      let department:
        | { id: number; name: string; code: string }
        | undefined;
      if (departmentId) {
        department =
          students[0]?.department ??
          ((await prisma.department.findUnique({
            where: { id: Number(departmentId) },
            select: { id: true, name: true, code: true },
          })) ?? undefined);
      }

      genderBreakdown = {
        scope: departmentId ? "department" : "semester",
        department,
        byClass,
      };
    }

    return NextResponse.json({
      students,
      summary: {
        total: students.length,
        byStatus,
        byGender,
      },
      genderBreakdown,
      filters: {
        program,
        semester: semester || null,
        year: year,
      },
    });
  } catch (e) {
    console.error("Admission report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
