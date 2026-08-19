import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

const SEMESTER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

/** Canonical form so "Semester Eight" and "Semester 8" compare equal. */
export function normalizedSemester(s: string): string {
  let out = String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  for (const [word, num] of Object.entries(SEMESTER_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }
  return out.replace(/[^a-z0-9]/g, "");
}

/** Loose semester compare so "Semester Eight" and "Semester 8" match. */
export function semestersMatch(a: string, b: string): boolean {
  if (String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()) return true;
  return normalizedSemester(a) === normalizedSemester(b);
}

/**
 * Record (upsert) a student's enrollment history row for the term of the given
 * class. Keyed by (studentId, semester, year) so re-running is idempotent and a
 * later concrete class always wins for that term.
 *
 * Failures are swallowed so history tracking never blocks the main mutation.
 */
export async function recordEnrollmentForClass(
  db: Db,
  studentId: number,
  classId: number | null | undefined
): Promise<void> {
  if (!classId || !Number.isInteger(classId)) return;
  try {
    const cls = await db.class.findUnique({
      where: { id: classId },
      select: { id: true, semester: true, year: true, departmentId: true, program: true },
    });
    if (!cls) return;
    await db.studentEnrollment.upsert({
      where: {
        studentId_semester_year: { studentId, semester: cls.semester, year: cls.year },
      },
      create: {
        studentId,
        classId: cls.id,
        departmentId: cls.departmentId,
        program: cls.program,
        semester: cls.semester,
        year: cls.year,
      },
      update: {
        classId: cls.id,
        departmentId: cls.departmentId,
        program: cls.program,
      },
    });
  } catch (e) {
    console.error("recordEnrollmentForClass failed", { studentId, classId, e });
  }
}

/**
 * Ensure a (student, semester, year) enrollment row exists so finance/exam
 * history stays attached to that term after the student is upgraded.
 * Does not overwrite an existing concrete classId.
 */
export async function ensureEnrollmentForTerm(
  db: Db,
  params: {
    studentId: number;
    semester: string;
    year: number;
    departmentId: number;
    program?: string | null;
    classId?: number | null;
  }
): Promise<void> {
  const semester = String(params.semester ?? "").trim();
  const year = params.year;
  if (!semester || !Number.isInteger(year)) return;

  try {
    let classId =
      params.classId && Number.isInteger(params.classId) ? params.classId : null;

    if (!classId) {
      const matches = await db.class.findMany({
        where: {
          departmentId: params.departmentId,
          semester,
          year,
          ...(params.program ? { program: params.program } : {}),
        },
        select: { id: true },
        take: 2,
      });
      if (matches.length === 1) classId = matches[0].id;
    }

    const existing = await db.studentEnrollment.findUnique({
      where: {
        studentId_semester_year: {
          studentId: params.studentId,
          semester,
          year,
        },
      },
    });

    if (existing) {
      if (existing.classId == null && classId) {
        await db.studentEnrollment.update({
          where: { id: existing.id },
          data: { classId },
        });
      }
      return;
    }

    await db.studentEnrollment.create({
      data: {
        studentId: params.studentId,
        classId,
        departmentId: params.departmentId,
        program: params.program ?? "Bachelor",
        semester,
        year,
      },
    });
  } catch (e) {
    console.error("ensureEnrollmentForTerm failed", params, e);
  }
}

/** Record enrollment history for many students moving into the same class. */
export async function recordEnrollmentsForClass(
  db: Db,
  studentIds: number[],
  classId: number | null | undefined
): Promise<void> {
  if (!classId || !Number.isInteger(classId) || studentIds.length === 0) return;
  try {
    const cls = await db.class.findUnique({
      where: { id: classId },
      select: { id: true, semester: true, year: true, departmentId: true, program: true },
    });
    if (!cls) return;
    for (const studentId of studentIds) {
      await db.studentEnrollment.upsert({
        where: {
          studentId_semester_year: { studentId, semester: cls.semester, year: cls.year },
        },
        create: {
          studentId,
          classId: cls.id,
          departmentId: cls.departmentId,
          program: cls.program,
          semester: cls.semester,
          year: cls.year,
        },
        update: {
          classId: cls.id,
          departmentId: cls.departmentId,
          program: cls.program,
        },
      });
    }
  } catch (e) {
    console.error("recordEnrollmentsForClass failed", { studentIds, classId, e });
  }
}

/**
 * Student IDs that were enrolled in a given term, from enrollment history.
 * - class mode: only students whose history row points at one of the scope classes
 * - department mode: scope classes plus department-level rows (classId unknown)
 *   whose semester matches (covers rows reconstructed from payments/exams).
 */
export async function findEnrolledStudentIdsForTerm(params: {
  mode: "class" | "department";
  classIds: number[];
  departmentId: number;
  semester: string;
  year: number;
}): Promise<Set<number>> {
  const { mode, classIds, departmentId, semester, year } = params;
  const classIdSet = new Set(classIds);
  const ids = new Set<number>();

  const rows = await prisma.studentEnrollment.findMany({
    where: { year, departmentId },
    select: { studentId: true, classId: true, semester: true },
  });

  for (const r of rows) {
    if (r.classId != null && classIdSet.has(r.classId)) {
      ids.add(r.studentId);
      continue;
    }
    if (mode === "department" && r.classId == null && semestersMatch(r.semester, semester)) {
      ids.add(r.studentId);
    }
  }

  return ids;
}

/** Map of classId -> set of student IDs ever enrolled in that class (history). */
export async function findEnrollmentStudentIdsByClass(
  classIds: number[]
): Promise<Map<number, Set<number>>> {
  const map = new Map<number, Set<number>>();
  if (classIds.length === 0) return map;
  const rows = await prisma.studentEnrollment.findMany({
    where: { classId: { in: classIds } },
    select: { classId: true, studentId: true },
  });
  for (const r of rows) {
    if (r.classId == null) continue;
    const set = map.get(r.classId) ?? new Set<number>();
    set.add(r.studentId);
    map.set(r.classId, set);
  }
  return map;
}

/** All student IDs ever enrolled in any of the given classes (history). */
export async function findEnrollmentStudentIdsForClasses(
  classIds: number[]
): Promise<Set<number>> {
  const ids = new Set<number>();
  if (classIds.length === 0) return ids;
  const rows = await prisma.studentEnrollment.findMany({
    where: { classId: { in: classIds } },
    select: { studentId: true },
  });
  for (const r of rows) ids.add(r.studentId);
  return ids;
}
