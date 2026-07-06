import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeReportMeta, resolveFinanceReportScope } from "@/lib/finance-report-scope";
import {
  classifyStudentTermPayment,
  computeTermTuition,
  parseStudentPaymentStatusFilter,
} from "@/lib/tuition-amount";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const classId = searchParams.get("classId");
    const departmentId = searchParams.get("departmentId");
    const paymentStatusFilter = parseStudentPaymentStatusFilter(
      searchParams.get("paymentStatusFilter")
    );

    if (!semester || !year) {
      return NextResponse.json(
        { error: "semester and year are required" },
        { status: 400 }
      );
    }

    if (!classId && !departmentId) {
      return NextResponse.json(
        { error: "classId or departmentId is required" },
        { status: 400 }
      );
    }

    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const resolved = await resolveFinanceReportScope(
      semester,
      parsedYear,
      classId,
      departmentId
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const studentsInScope = await prisma.student.findMany({
      where: { classId: { in: resolved.classIds }, status: "Admitted" },
      include: {
        department: { select: { name: true, code: true, tuitionFee: true } },
        class: { select: { id: true, name: true, department: { select: { code: true } } } },
        tuitionPayments: {
          where: { semester, year: parsedYear },
          select: { id: true, amount: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    const unpaidStudents = studentsInScope
      .filter((s) => {
        const classification = classifyStudentTermPayment(
          s,
          s.tuitionPayments,
          paymentStatusFilter
        );
        return classification === "unpaid";
      })
      .map((s) => {
        const { paymentStatus, expectedAmount, paidAmount } = computeTermTuition(
          s,
          s.tuitionPayments
        );
        const amountDue = expectedAmount - paidAmount;
        return {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          phone: s.phone,
          department: s.department,
          className: s.class?.name ?? null,
          tuitionFee: amountDue,
          paymentStatus,
          amountPaid: paidAmount,
          amountDue,
        };
      });

    return NextResponse.json({
      ...financeReportMeta(resolved.scope),
      semester,
      year: parsedYear,
      paymentStatusFilter,
      unpaidStudents,
      totalUnpaid: unpaidStudents.length,
    });
  } catch (e) {
    console.error("Unpaid students error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
