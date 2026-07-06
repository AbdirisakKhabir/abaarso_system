import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GenderCounts = {
  Male: number;
  Female: number;
  Unspecified: number;
  total: number;
};

function countByGender(students: { gender: string | null }[]): GenderCounts {
  const counts: GenderCounts = { Male: 0, Female: 0, Unspecified: 0, total: students.length };
  for (const s of students) {
    if (s.gender === "Male") counts.Male += 1;
    else if (s.gender === "Female") counts.Female += 1;
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
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const status = searchParams.get("status");
    const gender = searchParams.get("gender");

    const where: {
      departmentId?: number;
      classId?: number;
      status?: string;
      gender?: string;
    } = {};

    if (departmentId) {
      where.departmentId = Number(departmentId);
    }

    if (classId) {
      where.classId = Number(classId);
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (gender && gender !== "all") {
      where.gender = gender;
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
      scope: "class" | "department";
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

    if (departmentId || classId) {
      if (classId) {
        const cls = students[0]?.class ?? (await prisma.class.findUnique({
          where: { id: Number(classId) },
          select: { id: true, name: true, semester: true, year: true },
        }));
        const counts = countByGender(students);
        genderBreakdown = {
          scope: "class",
          byClass: cls
            ? [{
                classId: cls.id,
                className: cls.name,
                semester: cls.semester,
                year: cls.year,
                Male: counts.Male,
                Female: counts.Female,
                Unspecified: counts.Unspecified,
                total: counts.total,
              }]
            : [],
        };
      } else if (departmentId) {
        const dept = students[0]?.department ?? (await prisma.department.findUnique({
          where: { id: Number(departmentId) },
          select: { id: true, name: true, code: true },
        }));

        const classesInDept = await prisma.class.findMany({
          where: { departmentId: Number(departmentId) },
          select: { id: true, name: true, semester: true, year: true },
          orderBy: [{ year: "desc" }, { name: "asc" }],
        });

        const studentsForBreakdown = await prisma.student.findMany({
          where: {
            departmentId: Number(departmentId),
            ...(status && status !== "all" ? { status } : {}),
            ...(gender && gender !== "all" ? { gender } : {}),
          },
          select: { classId: true, gender: true },
        });

        const byClassId = new Map<number, { gender: string | null }[]>();
        for (const s of studentsForBreakdown) {
          if (s.classId == null) continue;
          const list = byClassId.get(s.classId) ?? [];
          list.push({ gender: s.gender });
          byClassId.set(s.classId, list);
        }

        const byClass = classesInDept
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

        genderBreakdown = {
          scope: "department",
          department: dept ?? undefined,
          byClass,
        };
      }
    }

    return NextResponse.json({
      students,
      summary: {
        total: students.length,
        byStatus,
        byGender,
      },
      genderBreakdown,
    });
  } catch (e) {
    console.error("Admission report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
