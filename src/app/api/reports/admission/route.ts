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
    const status = searchParams.get("status");

    const baseWhere: { departmentId?: number; id?: { in: number[] }; status?: string } = {};

    if (departmentId) {
      baseWhere.departmentId = Number(departmentId);
    }

    if (classId) {
      const parsedClassId = Number(classId);
      const records = await prisma.attendanceRecord.findMany({
        where: { session: { classId: parsedClassId } },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      const studentIds = records.map((r) => r.studentId);
      if (studentIds.length === 0) {
        return NextResponse.json({ students: [], summary: { total: 0, byStatus: {} } });
      }
      baseWhere.id = { in: studentIds };
    }

    const where = baseWhere;

    if (status && status !== "all") {
      where.status = status;
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
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

    return NextResponse.json({
      students,
      summary: {
        total: students.length,
        byStatus,
      },
    });
  } catch (e) {
    console.error("Admission report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
