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
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const departmentId = searchParams.get("departmentId");
    const semester = searchParams.get("semester");

    const where: { year: number; semester?: string; course?: { departmentId: number } } = {
      year: Number(year),
    };
    if (semester) where.semester = semester;
    if (departmentId) where.course = { departmentId: Number(departmentId) };

    const classes = await prisma.class.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, code: true, department: { select: { id: true, name: true, code: true } } } },
        students: {
          include: {
            tuitionPayments: {
              where: { year: Number(year) },
              select: { semester: true, year: true, amount: true },
            },
          },
        },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { name: "asc" }],
    });

    const result = classes.map((cls) => {
      const revenue = cls.students.reduce((sum, s) => {
        const paid = s.tuitionPayments.reduce((a, p) => a + p.amount, 0);
        return sum + paid;
      }, 0);
      const studentCount = cls.students.length;
      const paidCount = cls.students.filter((s) => s.tuitionPayments.length > 0).length;

      return {
        id: cls.id,
        name: cls.name,
        semester: cls.semester,
        year: cls.year,
        course: cls.course,
        department: cls.course.department,
        studentCount,
        paidCount,
        unpaidCount: studentCount - paidCount,
        revenue,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Class revenue error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
