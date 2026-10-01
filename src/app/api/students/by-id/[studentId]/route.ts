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
            department: { select: { code: true, name: true } },
          },
        },
        tuitionPayments: {
          orderBy: [{ year: "desc" }, { semester: "asc" }],
          select: { id: true, semester: true, year: true, amount: true, paidAt: true, financeHead: true },
        },
        tuitionCharges: {
          orderBy: [{ year: "desc" }, { createdAt: "desc" }],
          select: { id: true, semester: true, year: true, amount: true, note: true, createdAt: true },
        },
        leaves: {
          orderBy: [{ startDate: "desc" }],
          select: {
            id: true,
            startDate: true,
            endDate: true,
            expectedEndDate: true,
            leaveType: true,
            leaveTypeOther: true,
            approvalStatus: true,
            reason: true,
          },
        },
        enrollments: {
          orderBy: [{ year: "desc" }, { semester: "asc" }],
          select: {
            id: true,
            semester: true,
            year: true,
            class: { select: { id: true, name: true } },
          },
        },
        examRecords: {
          orderBy: [{ year: "desc" }, { semester: "asc" }],
          select: {
            id: true,
            semester: true,
            year: true,
            totalMarks: true,
            grade: true,
            course: { select: { code: true, name: true } },
          },
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
