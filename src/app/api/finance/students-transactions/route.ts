import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSemesterNames } from "@/lib/semesters";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const year = searchParams.get("year");
    const phone = searchParams.get("phone")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();

    const where: { status: string; departmentId?: number; classId?: number; phone?: { contains: string } } = { status: "Admitted" };
    if (departmentId) where.departmentId = Number(departmentId);
    if (classId) where.classId = Number(classId);
    if (phone) where.phone = { contains: phone };

    const paymentWhere: { year?: number; paidAt?: { gte?: Date; lte?: Date } } = {};
    if (year) paymentWhere.year = Number(year);
    if (dateFrom) paymentWhere.paidAt = { ...(paymentWhere.paidAt || {}), gte: new Date(dateFrom + "T00:00:00.000Z") };
    if (dateTo) paymentWhere.paidAt = { ...(paymentWhere.paidAt || {}), lte: new Date(dateTo + "T23:59:59.999Z") };

    const students = await prisma.student.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true, tuitionFee: true } },
        class: { select: { id: true, name: true, semester: true, year: true, course: { select: { code: true } } } },
        tuitionPayments: {
          where: Object.keys(paymentWhere).length > 0 ? paymentWhere : undefined,
          select: { id: true, semester: true, year: true, amount: true, paidAt: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    const yearFilter = year ? Number(year) : new Date().getFullYear();
    const activeSemesterNames = await getActiveSemesterNames();

    const result = students.map((s) => {
      const paidSemesters = s.tuitionPayments.map((p) => `${p.semester}-${p.year}`);
      const allSemestersForYear = activeSemesterNames.map((sem) => `${sem}-${yearFilter}`);
      const unpaidSemesters = allSemestersForYear.filter((sem) => !paidSemesters.includes(sem));
      const totalPaid = s.tuitionPayments.reduce((sum, p) => sum + p.amount, 0);

      return {
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        department: s.department,
        class: s.class,
        tuitionFee: s.department.tuitionFee,
        payments: s.tuitionPayments,
        paidCount: s.tuitionPayments.length,
        unpaidCount: unpaidSemesters.length,
        paidSemesters,
        unpaidSemesters,
        totalPaid,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Students transactions error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
