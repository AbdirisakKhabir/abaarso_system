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

const EMPTY_RESPONSE = {
  students: [],
  summary: {
    total: 0,
    byStatus: {} as Record<string, number>,
    byGender: { Male: 0, Female: 0, Unspecified: 0, total: 0 },
  },
  genderBreakdown: null,
};

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

    // Shared student-level filters (program/status/gender + department).
    const baseWhere: Prisma.StudentWhereInput = { program };
    if (departmentId) baseWhere.departmentId = Number(departmentId);
    if (status && status !== "all") baseWhere.status = status;
    if (gender && gender !== "all" && (gender === "Male" || gender === "Female")) {
      baseWhere.gender = { in: genderFilterValues(gender) };
    }

    const termScoped = Boolean(classId || semester || year != null);

    const studentInclude = {
      department: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true, semester: true, year: true } },
    } as const;

    type LoadedStudent = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

    let students: LoadedStudent[];
    // For term-scoped reports, the class shown/grouped is the historical class
    // for that term (enrollment history), not the student's current class.
    let termClassByStudent = new Map<number, { id: number; name: string; semester: string; year: number }>();

    if (!termScoped) {
      students = await prisma.student.findMany({
        where: baseWhere,
        include: studentInclude,
        orderBy: [{ admissionDate: "desc" }, { createdAt: "desc" }],
      });
    } else {
      // Resolve the classes that belong to the selected term.
      const classWhere: Prisma.ClassWhereInput = { program };
      if (departmentId) classWhere.departmentId = Number(departmentId);
      if (semester) classWhere.semester = semester;
      if (year != null) classWhere.year = year;
      if (classId) classWhere.id = Number(classId);

      const termClasses = await prisma.class.findMany({
        where: classWhere,
        select: { id: true, name: true, semester: true, year: true },
      });

      if (termClasses.length === 0) {
        return NextResponse.json(EMPTY_RESPONSE);
      }

      const classMeta = new Map(termClasses.map((c) => [c.id, c]));
      const termClassIds = termClasses.map((c) => c.id);

      // Cohort = students enrolled in these classes historically (upgrade-safe)
      // plus students currently in these classes (fallback before backfill).
      const [enrollmentRows, currentRows] = await Promise.all([
        prisma.studentEnrollment.findMany({
          where: { classId: { in: termClassIds } },
          select: { studentId: true, classId: true },
        }),
        prisma.student.findMany({
          where: { ...baseWhere, classId: { in: termClassIds } },
          select: { id: true, classId: true },
        }),
      ]);

      const cohortIds = new Set<number>();
      for (const r of enrollmentRows) {
        cohortIds.add(r.studentId);
        if (r.classId != null && classMeta.has(r.classId)) {
          termClassByStudent.set(r.studentId, classMeta.get(r.classId)!);
        }
      }
      for (const r of currentRows) {
        cohortIds.add(r.id);
        if (r.classId != null && classMeta.has(r.classId) && !termClassByStudent.has(r.id)) {
          termClassByStudent.set(r.id, classMeta.get(r.classId)!);
        }
      }

      if (cohortIds.size === 0) {
        return NextResponse.json(EMPTY_RESPONSE);
      }

      students = await prisma.student.findMany({
        where: { ...baseWhere, id: { in: [...cohortIds] } },
        include: studentInclude,
        orderBy: [{ admissionDate: "desc" }, { createdAt: "desc" }],
      });

      // Show the historical term class instead of the current class.
      students = students.map((s) => {
        const termClass = termClassByStudent.get(s.id);
        return termClass ? { ...s, class: termClass } : s;
      });
    }

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

      // Group by the historical term class (falls back to current class).
      const byClassId = new Map<number, { gender: string | null }[]>();
      for (const s of students) {
        const groupClassId = termClassByStudent.get(s.id)?.id ?? s.classId;
        if (groupClassId == null) continue;
        const list = byClassId.get(groupClassId) ?? [];
        list.push({ gender: s.gender });
        byClassId.set(groupClassId, list);
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

      let department: { id: number; name: string; code: string } | undefined;
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
        year,
      },
    });
  } catch (e) {
    console.error("Admission report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
