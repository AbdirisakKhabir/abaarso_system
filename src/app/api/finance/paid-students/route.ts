import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  financeReportMeta,
  findStudentsForFinanceTermReport,
  resolveFinanceReportScope,
} from "@/lib/finance-report-scope";
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

    const { students: studentsInScope, source } = await findStudentsForFinanceTermReport(
      resolved,
      semester,
      parsedYear
    );

    let unpaidInFilter = 0;
    let excludedByType = 0;

    const paidStudents = studentsInScope
      .filter((s) => {
        const termPayments = filterTermPayments(s.tuitionPayments, semester, parsedYear);
        // Enrolled-only students with no payments for this term are unpaid, not paid.
        const fallbackFee = fallbackTuitionFeeFromScope(resolved, s.department?.id);
        const classification = classifyStudentTermPayment(
          s,
          termPayments,
          paymentStatusFilter,
          fallbackFee
        );
        if (classification === "excluded") {
          excludedByType += 1;
          return false;
        }
        if (classification === "unpaid") {
          unpaidInFilter += 1;
          return false;
        }
        return true;
      })
      .map((s) => {
        const termPayments = filterTermPayments(s.tuitionPayments, semester, parsedYear);
        const fallbackFee = fallbackTuitionFeeFromScope(resolved, s.department?.id);
        const { paymentStatus, expectedAmount, paidAmount } = computeTermTuition(
          s,
          termPayments,
          fallbackFee
        );
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
          paymentStatus,
          amountPaid: paidAmount,
          amountExpected: expectedAmount,
        };
      });

    return NextResponse.json({
      ...financeReportMeta(resolved.scope),
      semester,
      year: parsedYear,
      paymentStatusFilter,
      paidStudents,
      totalPaid: paidStudents.length,
      summary: {
        studentsInScope: studentsInScope.length,
        paid: paidStudents.length,
        unpaid: unpaidInFilter,
        excludedByStudentType: excludedByType,
        source,
      },
    });
  } catch (e) {
    console.error("Paid students error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
