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

export const LEAVE_TYPES = [
  "Medical",
  "Personal",
  "Academic",
  "Military Service",
  "Maternity/Paternity",
  "Other",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export function parseLeaveType(value: unknown): LeaveType | null {
  const v = String(value ?? "").trim();
  return (LEAVE_TYPES as readonly string[]).includes(v) ? (v as LeaveType) : null;
}

export const ON_LEAVE_ATTENDANCE_NOTE = "On leave";

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC-midnight bounds of a calendar day (attendance dates are stored as UTC `@db.Date`). */
export function utcDayBounds(date: Date | string): { start: Date; end: Date } {
  const d = date instanceof Date ? date : new Date(date);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Parse a "YYYY-MM-DD" (or ISO) value to UTC midnight; null when empty/invalid. */
export function parseLeaveDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return utcDayBounds(d).start;
}

/**
 * Approved leave covering `date`:
 * startDate ≤ date ≤ expectedEndDate (inclusive) and not yet returned on/before that day.
 */
function leaveCoversDayWhere(date: Date | string): Prisma.StudentLeaveWhereInput {
  const { start, end } = utcDayBounds(date);
  return {
    approvalStatus: "Approved",
    startDate: { lt: end },
    AND: [
      { OR: [{ endDate: null }, { endDate: { gte: end } }] },
      { OR: [{ expectedEndDate: null }, { expectedEndDate: { gte: start } }] },
    ],
  };
}

export type ActiveLeaveInfo = {
  leaveId: number;
  studentId: number;
  leaveType: string | null;
  startDate: Date;
  expectedEndDate: Date | null;
};

/** Students (from `studentIds`) with an ongoing approved leave on `date`. */
export async function findStudentsOnLeave(
  db: Db,
  studentIds: number[],
  date: Date | string
): Promise<Map<number, ActiveLeaveInfo>> {
  const ids = [...new Set(studentIds.filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map<number, ActiveLeaveInfo>();
  if (ids.length === 0) return map;
  const rows = await db.studentLeave.findMany({
    where: { studentId: { in: ids }, ...leaveCoversDayWhere(date) },
    select: { id: true, studentId: true, leaveType: true, startDate: true, expectedEndDate: true },
    orderBy: { startDate: "desc" },
  });
  for (const r of rows) {
    if (map.has(r.studentId)) continue;
    map.set(r.studentId, {
      leaveId: r.id,
      studentId: r.studentId,
      leaveType: r.leaveType,
      startDate: r.startDate,
      expectedEndDate: r.expectedEndDate,
    });
  }
  return map;
}

/** Force records of students on leave (for the session's date) to Present. */
export async function enforceLeaveAttendanceForSession(db: Db, sessionId: number): Promise<number> {
  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { date: true, records: { select: { studentId: true } } },
  });
  if (!session) return 0;
  const onLeave = await findStudentsOnLeave(
    db,
    session.records.map((r) => r.studentId),
    session.date
  );
  if (onLeave.size === 0) return 0;
  const res = await db.attendanceRecord.updateMany({
    where: { sessionId, studentId: { in: [...onLeave.keys()] }, status: { not: "Present" } },
    data: { status: "Present", note: ON_LEAVE_ATTENDANCE_NOTE },
  });
  return res.count;
}

/**
 * Back-fill attendance already taken during a leave period so every record
 * inside it is Present (e.g. leave recorded after the fact, or extended).
 */
export async function syncAttendanceForLeave(db: Db, leaveId: number): Promise<number> {
  const leave = await db.studentLeave.findUnique({
    where: { id: leaveId },
    select: {
      studentId: true,
      startDate: true,
      endDate: true,
      expectedEndDate: true,
      approvalStatus: true,
    },
  });
  if (!leave || leave.approvalStatus !== "Approved") return 0;

  const from = utcDayBounds(leave.startDate).start;
  // Exclusive upper bound: the day the student returned, or the day after the planned end.
  const bounds: Date[] = [];
  if (leave.endDate) bounds.push(utcDayBounds(leave.endDate).start);
  if (leave.expectedEndDate) bounds.push(utcDayBounds(leave.expectedEndDate).end);
  const until = bounds.length > 0 ? new Date(Math.min(...bounds.map((b) => b.getTime()))) : null;
  if (until && until <= from) return 0;

  const res = await db.attendanceRecord.updateMany({
    where: {
      studentId: leave.studentId,
      status: { not: "Present" },
      session: { date: { gte: from, ...(until ? { lt: until } : {}) } },
    },
    data: { status: "Present", note: ON_LEAVE_ATTENDANCE_NOTE },
  });
  return res.count;
}

/** Text field from the leave form: trimmed, length-capped, null when empty. */
function text(value: unknown, max = 191): string | null {
  const v = value != null ? String(value).trim() : "";
  return v ? v.slice(0, max) : null;
}

/**
 * Parse Student Leave Form fields shared by create (POST) and edit (PUT).
 * Returns an error message when the input is invalid.
 */
export function parseLeaveFormBody(
  body: Record<string, unknown>
):
  | { error: string }
  | {
      data: {
        leaveType: string | null;
        leaveTypeOther: string | null;
        startDate: Date | null;
        expectedEndDate: Date | null;
        reason: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        parentPhone: string | null;
        documentUrl: string | null;
        documentPublicId: string | null;
        declarationSigned: boolean;
        approvedByName: string | null;
        approvalDate: Date | null;
      };
    } {
  let leaveType: string | null = null;
  if (body.leaveType != null && body.leaveType !== "") {
    leaveType = parseLeaveType(body.leaveType);
    if (!leaveType) return { error: "Invalid leave type" };
  }
  const leaveTypeOther = leaveType === "Other" ? text(body.leaveTypeOther) : null;
  if (leaveType === "Other" && !leaveTypeOther) {
    return { error: "Please specify the leave type." };
  }

  const startDate = parseLeaveDate(body.startDate);
  if (body.startDate && !startDate) return { error: "Invalid start date" };
  const expectedEndDate = parseLeaveDate(body.expectedEndDate);
  if (body.expectedEndDate && !expectedEndDate) return { error: "Invalid end date" };
  if (startDate && expectedEndDate && expectedEndDate < startDate) {
    return { error: "End date of leave cannot be before the start date." };
  }
  const approvalDate = parseLeaveDate(body.approvalDate);
  if (body.approvalDate && !approvalDate) return { error: "Invalid approval date" };

  const contactEmail = text(body.contactEmail);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: "Invalid contact email" };
  }

  return {
    data: {
      leaveType,
      leaveTypeOther,
      startDate,
      expectedEndDate,
      reason: text(body.reason, 8000),
      contactEmail,
      contactPhone: text(body.contactPhone),
      parentPhone: text(body.parentPhone),
      documentUrl: text(body.documentUrl, 2000),
      documentPublicId: text(body.documentPublicId),
      declarationSigned: body.declarationSigned === true,
      approvedByName: text(body.approvedByName),
      approvalDate,
    },
  };
}
