import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTermSequence } from "@/lib/semester-term-sequence";
import { perSemesterTuition } from "@/lib/tuition-amount";

/**
 * POST /api/students/bulk-tuition-charge
 * Adds (per-semester amount × semesterCount) to each student's balance.
 * Body: { studentIds: number[], semesterCount: number, startingSemester: string, startingYear: number }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const studentIds = Array.isArray(body.studentIds)
      ? body.studentIds
          .map((x: unknown) => Number(x))
          .filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    const semesterCount = Number(body.semesterCount);
    const startingSemester = String(body.startingSemester ?? "").trim();
    const startingYear = Number(body.startingYear);

    if (studentIds.length === 0) {
      return NextResponse.json({ error: "Select at least one student" }, { status: 400 });
    }
    if (!Number.isInteger(semesterCount) || semesterCount < 1 || semesterCount > 24) {
      return NextResponse.json(
        { error: "semesterCount must be between 1 and 24" },
        { status: 400 }
      );
    }
    if (!startingSemester) {
      return NextResponse.json({ error: "Starting semester is required" }, { status: 400 });
    }
    if (!Number.isInteger(startingYear) || startingYear < 2000 || startingYear > 2100) {
      return NextResponse.json({ error: "Invalid starting year" }, { status: 400 });
    }

    const semesterRows = await prisma.semester.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const orderedNames = semesterRows.map((s) => s.name);

    let periods: { semester: string; year: number }[];
    try {
      periods = buildTermSequence(orderedNames, startingSemester, startingYear, semesterCount);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid starting semester. Use an active semester from Settings → Semesters.",
        },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        department: { select: { name: true, code: true, tuitionFee: true } },
      },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const notFound = studentIds.filter((id: number) => !foundIds.has(id));

    const results: {
      id: number;
      studentId: string;
      firstName: string;
      lastName: string;
      charge: number;
      newBalance: number;
    }[] = [];
    const skipped: { id: number; reason: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const s of students) {
        const per = perSemesterTuition(
          s.department.tuitionFee ?? 0,
          s.paymentStatus
        );
        const charge = per * semesterCount;
        if (charge <= 0) {
          skipped.push({
            id: s.id,
            reason:
              s.paymentStatus === "Full Scholarship"
                ? "Full scholarship (no tuition)"
                : "Zero department fee",
          });
          continue;
        }
        const updated = await tx.student.update({
          where: { id: s.id },
          data: { balance: { increment: charge } },
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            balance: true,
          },
        });
        results.push({
          id: updated.id,
          studentId: updated.studentId,
          firstName: updated.firstName,
          lastName: updated.lastName,
          charge,
          newBalance: updated.balance,
        });
      }
    });

    return NextResponse.json({
      periods,
      charged: results.length,
      results,
      skipped: skipped.length ? skipped : undefined,
      notFound: notFound.length ? notFound : undefined,
    });
  } catch (e) {
    console.error("bulk-tuition-charge error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
