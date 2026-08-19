import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  financeReportMeta,
  findStudentsForFinanceTermReport,
  resolveFinanceReportScope,
} from "@/lib/finance-report-scope";
import {
  classifyPaymentCompletion,
  computeTermTuition,
  filterTermPayments,
  matchesCompletionFilter,
  matchesStudentPaymentStatusFilter,
  parsePaymentCompletionFilter,
  parseStudentPaymentStatusFilter,
  semesterAmountPaid,
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
    // Anyone who still owes for the term (unpaid + partial). "nonpaid" / "partial" still available.
    const completionFilter = parsePaymentCompletionFilter(
      searchParams.get("completion"),
      "owing"
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

    let nonpaidCount = 0;
    let partialCount = 0;

    const unpaidStudents = studentsInScope
      .map((s) => {
        const termPayments = filterTermPayments(s.tuitionPayments, semester, parsedYear);
        const chargedAmount = semesterAmountPaid(
          filterTermPayments(s.tuitionCharges, semester, parsedYear)
        );
        const fallbackFee = fallbackTuitionFeeFromScope(resolved, s.department?.id);
        const typeOk = matchesStudentPaymentStatusFilter(s.paymentStatus, paymentStatusFilter);
        if (!typeOk && !(paymentStatusFilter === "all" && chargedAmount > 0)) {
          return null;
        }
        const { paymentStatus, expectedAmount: billedOrCatalog, paidAmount } = computeTermTuition(
          s,
          termPayments,
          fallbackFee,
          chargedAmount
        );
        // Legacy leftover: student is in this class, has a ledger balance, but no invoice row.
        const inThisClass = s.class?.id != null && resolved.classIds.includes(s.class.id);
        const expectedAmount =
          billedOrCatalog > 0
            ? billedOrCatalog
            : chargedAmount <= 0 && paidAmount <= 0 && inThisClass && (s.balance ?? 0) > 0
              ? Number(s.balance)
              : billedOrCatalog;
        const completion = classifyPaymentCompletion(expectedAmount, paidAmount);
        if (completion === "partial") partialCount += 1;
        else if (completion === "nonpaid") nonpaidCount += 1;

        if (!matchesCompletionFilter(completion, completionFilter)) return null;

        const amountDue = Math.max(0, expectedAmount - paidAmount);
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
          completion,
          amountPaid: paidAmount,
          amountDue,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({
      ...financeReportMeta(resolved.scope),
      semester,
      year: parsedYear,
      paymentStatusFilter,
      completion: completionFilter,
      unpaidStudents,
      totalUnpaid: unpaidStudents.length,
      summary: {
        studentsInScope: studentsInScope.length,
        nonpaid: nonpaidCount,
        partial: partialCount,
        source,
      },
    });
  } catch (e) {
    console.error("Unpaid students error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
