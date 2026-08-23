import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type ChargePeriod = { semester: string; year: number };

/**
 * Record billed tuition for one or more terms. Skips zero/negative amounts.
 * Multiple charges for the same term are allowed and summed on reports.
 */
export async function recordTuitionCharges(
  db: Db,
  params: {
    studentId: number;
    periods: ChargePeriod[];
    amountPerPeriod: number;
    chargedById?: number | null;
    note?: string | null;
  }
): Promise<number> {
  const amount = Number(params.amountPerPeriod);
  if (!(amount > 0) || params.periods.length === 0) return 0;

  const rows = params.periods
    .filter((p) => p.semester && Number.isInteger(p.year))
    .map((p) => ({
      studentId: params.studentId,
      semester: String(p.semester).trim(),
      year: p.year,
      amount,
      note: params.note ?? null,
      chargedById: params.chargedById ?? null,
    }))
    .filter((r) => r.semester);

  if (rows.length === 0) return 0;
  await db.tuitionCharge.createMany({ data: rows });
  return rows.length;
}

/** Charge one term using the class the student is assigned to. No-op without a class. */
export async function recordTuitionChargeForClass(
  db: Db,
  params: {
    studentId: number;
    classId: number | null | undefined;
    amount: number;
    chargedById?: number | null;
    note?: string | null;
  }
): Promise<boolean> {
  if (!params.classId || !Number.isInteger(params.classId) || !(params.amount > 0)) {
    return false;
  }
  const cls = await db.class.findUnique({
    where: { id: params.classId },
    select: { semester: true, year: true },
  });
  if (!cls) return false;
  await recordTuitionCharges(db, {
    studentId: params.studentId,
    periods: [{ semester: cls.semester, year: cls.year }],
    amountPerPeriod: params.amount,
    chargedById: params.chargedById,
    note: params.note ?? "Registration",
  });
  return true;
}

export type DischargeStudentResult = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  reversed: number;
  newBalance: number;
  chargesRemoved: number;
};

/**
 * Reverse billed tuition for a set of charge rows and/or manual balance amounts.
 * Balance is never driven below zero.
 */
export async function dischargeTuition(
  db: Db,
  params: {
    items: {
      studentId: number;
      reverseAmount: number;
      chargeIds: number[];
    }[];
    minimizeBalance: boolean;
    removeCharges: boolean;
  }
): Promise<DischargeStudentResult[]> {
  const results: DischargeStudentResult[] = [];
  for (const item of params.items) {
    const student = await db.student.findUnique({
      where: { id: item.studentId },
      select: { id: true, studentId: true, firstName: true, lastName: true, balance: true },
    });
    if (!student) continue;

    let reversed = 0;
    if (params.minimizeBalance) {
      const amt = Math.max(0, Number(item.reverseAmount) || 0);
      reversed = Math.min(Math.max(0, student.balance ?? 0), amt);
      if (reversed > 0) {
        const updated = await db.student.update({
          where: { id: student.id },
          data: { balance: { decrement: reversed } },
          select: { balance: true },
        });
        student.balance = updated.balance;
      }
    }

    let chargesRemoved = 0;
    if (params.removeCharges && item.chargeIds.length > 0) {
      const del = await db.tuitionCharge.deleteMany({
        where: { id: { in: item.chargeIds }, studentId: student.id },
      });
      chargesRemoved = del.count;
    }

    results.push({
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      reversed,
      newBalance: student.balance ?? 0,
      chargesRemoved,
    });
  }
  return results;
}
