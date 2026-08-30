import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Open a leave row when status becomes Leave; close open rows when they return.
 */
export async function syncLeaveOnStatusChange(
  db: Db,
  params: {
    studentId: number;
    previousStatus: string;
    nextStatus: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    reason?: string | null;
    recordedById?: number | null;
  }
): Promise<void> {
  const prev = String(params.previousStatus ?? "").trim();
  const next = String(params.nextStatus ?? "").trim();
  if (prev === next) return;

  const toDate = (v?: Date | string | null) => {
    if (!v) return new Date();
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  if (next === "Leave") {
    const open = await db.studentLeave.findFirst({
      where: { studentId: params.studentId, endDate: null },
      select: { id: true },
    });
    if (open) {
      if (params.reason != null && String(params.reason).trim()) {
        await db.studentLeave.update({
          where: { id: open.id },
          data: { reason: String(params.reason).trim().slice(0, 8000) },
        });
      }
      return;
    }
    await db.studentLeave.create({
      data: {
        studentId: params.studentId,
        startDate: toDate(params.startDate),
        reason: params.reason ? String(params.reason).trim().slice(0, 8000) : null,
        recordedById: params.recordedById ?? null,
      },
    });
    return;
  }

  if (prev === "Leave") {
    await db.studentLeave.updateMany({
      where: { studentId: params.studentId, endDate: null },
      data: { endDate: toDate(params.endDate) },
    });
  }
}
