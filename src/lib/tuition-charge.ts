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
