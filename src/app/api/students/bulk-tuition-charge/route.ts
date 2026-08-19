import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTermSequence } from "@/lib/semester-term-sequence";
import { perSemesterTuition } from "@/lib/tuition-amount";
import { recordTuitionCharges } from "@/lib/tuition-charge";
import { ensureEnrollmentForTerm } from "@/lib/enrollment";

/**
 * POST /api/students/bulk-tuition-charge
 * Adds (per-semester amount × semesterCount) to each student's balance.
 * Body: { studentIds, semesterCount, startingSemester, startingYear,
 *   perStudentPerSemester?: Record<string, number> } — optional map keyed by internal student id
 *   (string or number in JSON). When set for a student, that amount is used as the per-semester
 *   rate (admin override, including for scholarship students). Omitted ids use department fee + payment status rules.
 *
 * Validation: a student is skipped for any period they were already charged (duplicate detection
 * based on the tuition_charges table). The student is still charged for periods not yet billed.
 */

/** GET /api/students/bulk-tuition-charge — list charges with optional filters */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const studentIdStr = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const departmentId = searchParams.get("departmentId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 25)));

    const where: Prisma.TuitionChargeWhereInput = {};
    if (semester) where.semester = semester;
    if (year) {
      const y = Number(year);
      if (Number.isInteger(y)) where.year = y;
    }
    if (studentIdStr) {
      const student = await prisma.student.findUnique({ where: { studentId: studentIdStr }, select: { id: true } });
      if (student) where.studentId = student.id;
    }
    if (classId || departmentId) {
      const studentWhere: Prisma.StudentWhereInput = {};
      if (classId) { const cid = Number(classId); if (Number.isInteger(cid)) studentWhere.classId = cid; }
      if (departmentId) { const did = Number(departmentId); if (Number.isInteger(did)) studentWhere.departmentId = did; }
      const ids = await prisma.student.findMany({ where: studentWhere, select: { id: true } });
      where.studentId = { in: ids.map((s) => s.id) };
    }

    const [total, charges] = await Promise.all([
      prisma.tuitionCharge.count({ where }),
      prisma.tuitionCharge.findMany({
        where,
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true, code: true } },
              class: { select: { name: true } },
            },
          },
          chargedBy: { select: { name: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      charges: charges.map((c) => ({
        id: c.id,
        semester: c.semester,
        year: c.year,
        amount: c.amount,
        note: c.note,
        createdAt: c.createdAt,
        student: c.student,
        chargedBy: c.chargedBy,
      })),
    });
  } catch (e) {
    console.error("bulk-tuition-charge GET error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

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
    const sourceClassId =
      body.classId != null && Number.isInteger(Number(body.classId))
        ? Number(body.classId)
        : null;

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
      periodsCharged?: { semester: string; year: number }[];
      periodsSkipped?: number;
    }[] = [];
    const skipped: { id: number; reason: string }[] = [];

    // Pre-load all existing charges for (studentId, semester, year) combos in this batch
    const existingCharges =
      students.length > 0 && periods.length > 0
        ? await prisma.tuitionCharge.findMany({
            where: {
              studentId: { in: students.map((s) => s.id) },
              OR: periods.map((p) => ({ semester: p.semester, year: p.year })),
            },
            select: { studentId: true, semester: true, year: true },
          })
        : [];
    const chargedSet = new Set(
      existingCharges.map((c) => `${c.studentId}\0${c.semester}\0${c.year}`)
    );

    await prisma.$transaction(async (tx) => {
      for (const s of students) {
        const hasOverride = Object.prototype.hasOwnProperty.call(customById, s.id);
        const per = hasOverride
          ? customById[s.id]
          : perSemesterTuition(
              s.department.tuitionFee ?? 0,
              s.paymentStatus,
              s.customSemesterFee
            );

        if (per <= 0) {
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

        // Only charge periods not already billed for this student
        const newPeriods = periods.filter(
          (p) => !chargedSet.has(`${s.id}\0${p.semester}\0${p.year}`)
        );

        if (newPeriods.length === 0) {
          skipped.push({
            id: s.id,
            reason: periods.length === 1
              ? `Already charged for ${periods[0].semester} ${periods[0].year}`
              : `All ${periods.length} terms already charged`,
          });
          continue;
        }

        const alreadyBilledCount = periods.length - newPeriods.length;
        const charge = per * newPeriods.length;

        const updated = await tx.student.update({
          where: { id: s.id },
          data: { balance: { increment: charge } },
          select: { id: true, studentId: true, firstName: true, lastName: true, balance: true },
        });
        await recordTuitionCharges(tx, {
          studentId: s.id,
          periods: newPeriods,
          amountPerPeriod: per,
          chargedById: auth.userId,
          note: "Tuition charge",
        });
        for (const p of newPeriods) {
          await ensureEnrollmentForTerm(tx, {
            studentId: s.id,
            semester: p.semester,
            year: p.year,
            departmentId: s.departmentId,
            program: s.program,
            classId: sourceClassId,
          });
        }
        results.push({
          id: updated.id,
          studentId: updated.studentId,
          firstName: updated.firstName,
          lastName: updated.lastName,
          perSemester: per,
          charge,
          newBalance: updated.balance,
          usedCustomAmount: hasOverride,
          periodsCharged: newPeriods,
          periodsSkipped: alreadyBilledCount,
        });
      }
    });

    return NextResponse.json({
      periods,
      charged: results.length,
      skipped: skipped.length,
      results,
      skippedDetails: skipped.length ? skipped : undefined,
      notFound: notFound.length ? notFound : undefined,
    });
  } catch (e) {
    console.error("bulk-tuition-charge error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
