import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeReportMeta, resolveFinanceReportScope } from "@/lib/finance-report-scope";
import {
  classifyStudentTermPayment,
  computeTermTuition,
  filterTermPayments,
  parseStudentPaymentStatusFilter,
} from "@/lib/tuition-amount";

function fallbackTuitionFeeFromScope(
  scope: Awaited<ReturnType<typeof resolveFinanceReportScope>>,
  studentDepartmentId: number | null | undefined
): number | null {
  if (!scope.ok) return null;
  if (scope.scope.mode === "class") {
    return scope.scope.class.department.tuitionFee;
  }
  const match = scope.scope.classes.find((c) => c.department.id === studentDepartmentId);
  return match?.department.tuitionFee ?? scope.scope.classes[0]?.department.tuitionFee ?? null;
}

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
    const program = searchParams.get("program");
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
      departmentId,
      program
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const studentsInScope = await prisma.student.findMany({
      where: {
        classId: { in: resolved.classIds },
        status: "Admitted",
      },
      include: {
        department: { select: { id: true, name: true, code: true, tuitionFee: true } },
        class: { select: { id: true, name: true, department: { select: { code: true } } } },
        tuitionPayments: {
          where: { year: parsedYear },
          select: { id: true, amount: true, semester: true, year: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    const unpaidStudents = studentsInScope
      .filter((s) => {
        const termPayments = filterTermPayments(s.tuitionPayments, semester, parsedYear);
        const fallbackFee = fallbackTuitionFeeFromScope(resolved, s.department?.id);
        const classification = classifyStudentTermPayment(
          s,
          termPayments,
          paymentStatusFilter,
          fallbackFee
        );
        return classification === "unpaid";
      })
      .map((s) => {
        const termPayments = filterTermPayments(s.tuitionPayments, semester, parsedYear);
        const fallbackFee = fallbackTuitionFeeFromScope(resolved, s.department?.id);
        const { paymentStatus, expectedAmount, paidAmount } = computeTermTuition(
          s,
          termPayments,
          fallbackFee
        );
        const amountDue = expectedAmount - paidAmount;
        return {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          phone: s.phone,
          department: {
            name: s.department.name,
            code: s.department.code,
            tuitionFee: s.department.tuitionFee,
          },
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
