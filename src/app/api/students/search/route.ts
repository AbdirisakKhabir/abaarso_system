import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { perSemesterTuition } from "@/lib/tuition-amount";
import { computeStudentOwing, formatOwingSource } from "@/lib/student-term-ledger";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const students = await prisma.student.findMany({
      where: {
        OR: [
          { studentId: { contains: q } },
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: limit,
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
          where: { financeHead: "semester_fee" },
          orderBy: [{ year: "desc" }, { semester: "asc" }],
          select: { id: true, semester: true, year: true, amount: true, paidAt: true },
        },
        tuitionCharges: {
          select: { semester: true, year: true, amount: true },
          orderBy: [{ year: "asc" }, { semester: "asc" }],
        },
        enrollments: {
          select: {
            semester: true,
            year: true,
            class: { select: { id: true, name: true } },
          },
          orderBy: [{ year: "asc" }, { semester: "asc" }],
        },
      },
      orderBy: { studentId: "asc" },
    });

    const payload = students.map((s) => {
      const owing = computeStudentOwing({
        currentClass: s.class,
        enrollments: s.enrollments,
        charges: s.tuitionCharges,
        payments: s.tuitionPayments,
        expectedPerSemester: perSemesterTuition(
          s.department?.tuitionFee ?? 0,
          s.paymentStatus,
          s.customSemesterFee
        ),
        accountBalance: s.balance ?? 0,
      });
      return {
        ...s,
        owingTotal: owing.owingTotal,
        unknownBalance: owing.unknownBalance,
        owingSource: formatOwingSource(owing),
        owingTerms: owing.terms
          .filter((t) => t.remaining > 1e-6)
          .map((t) => ({
            semester: t.semester,
            year: t.year,
            remaining: t.remaining,
            isCurrent: t.isCurrent,
            alreadyCharged: t.alreadyCharged,
          })),
        owingPrimary: owing.primary
          ? {
              semester: owing.primary.semester,
              year: owing.primary.year,
              remaining: owing.primary.remaining,
              isCurrent: owing.primary.isCurrent,
            }
          : owing.unknownBalance > 1e-6
            ? { semester: "Unknown semester", year: null as number | null, remaining: owing.unknownBalance, isCurrent: false }
            : null,
      };
    });

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Student search error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
