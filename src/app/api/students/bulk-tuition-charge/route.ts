import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTermSequence } from "@/lib/semester-term-sequence";
import { perSemesterTuition } from "@/lib/tuition-amount";

/**
 * POST /api/students/bulk-tuition-charge
 * Adds (per-semester amount × semesterCount) to each student's balance.
 * Body: { studentIds, semesterCount, startingSemester, startingYear,
 *   perStudentPerSemester?: Record<string, number> } — optional map keyed by internal student id
 *   (string or number in JSON). When set for a student, that amount is used as the per-semester
 *   rate (admin override, including for scholarship students). Omitted ids use department fee + payment status rules.
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

    const rawCustom = body.perStudentPerSemester;
    const customById: Record<number, number> = {};
    if (rawCustom != null && typeof rawCustom === "object" && !Array.isArray(rawCustom)) {
      for (const [k, v] of Object.entries(rawCustom)) {
        const id = Number(k);
        const amt = Number(v);
        if (Number.isInteger(id) && id > 0 && Number.isFinite(amt) && amt >= 0) {
          customById[id] = amt;
        }
      }
    }

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
      perSemester: number;
      charge: number;
      newBalance: number;
      usedCustomAmount: boolean;
    }[] = [];
    const skipped: { id: number; reason: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const s of students) {
        const hasOverride = Object.prototype.hasOwnProperty.call(customById, s.id);
        const per = hasOverride
          ? customById[s.id]
          : perSemesterTuition(
              s.department.tuitionFee ?? 0,
              s.paymentStatus
            );
        const charge = per * semesterCount;
        if (charge <= 0) {
          skipped.push({
            id: s.id,
            reason: hasOverride
              ? "Custom per-semester amount is zero"
              : s.paymentStatus === "Full Scholarship"
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
          perSemester: per,
          charge,
          newBalance: updated.balance,
          usedCustomAmount: hasOverride,
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
