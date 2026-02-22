import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentId } = await ctx.params;
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { studentId: decodeURIComponent(studentId) },
      include: {
        department: { select: { id: true, name: true, code: true, tuitionFee: true } },
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            course: { select: { code: true, name: true } },
          },
        },
        tuitionPayments: {
          orderBy: [{ year: "desc" }, { semester: "asc" }],
          select: { id: true, semester: true, year: true, amount: true, paidAt: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (e) {
    console.error("Get student by ID error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
