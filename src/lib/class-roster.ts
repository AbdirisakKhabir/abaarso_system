import { prisma } from "@/lib/prisma";
import { semestersMatch } from "@/lib/semester-match";

/**
 * Student IDs that belong to a class for reporting — including students who
 * were later upgraded out of it.
 *
 * Sources (union):
 *  1. Current Student.classId
 *  2. StudentEnrollment rows pointing at this class
 *  3. Attendance taken in this class
 *  4. Exam records for this class's semester/year (same department/program),
 *     excluding students enrolled in a *different* class that term
 */
export async function findClassRosterStudentIds(classId: number): Promise<number[]> {
  if (!Number.isInteger(classId) || classId <= 0) return [];

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, semester: true, year: true, departmentId: true, program: true },
  });
  if (!cls) return [];

  const [current, enrolled, attended, termEnrollments, examRows] = await Promise.all([
    prisma.student.findMany({
      where: { classId },
      select: { id: true },
    }),
    prisma.studentEnrollment.findMany({
      where: { classId },
      select: { studentId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { session: { classId } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    prisma.studentEnrollment.findMany({
      where: { year: cls.year, departmentId: cls.departmentId },
      select: { studentId: true, classId: true, semester: true },
    }),
    prisma.examRecord.findMany({
      where: {
        year: cls.year,
        course: { departmentId: cls.departmentId, program: cls.program },
      },
      select: { studentId: true, semester: true },
    }),
  ]);

  const otherClassThisTerm = new Set<number>();
  for (const e of termEnrollments) {
    if (!semestersMatch(e.semester, cls.semester)) continue;
    if (e.classId != null && e.classId !== classId) {
      otherClassThisTerm.add(e.studentId);
    }
  }

  const ids = new Set<number>();
  for (const s of current) ids.add(s.id);
  for (const e of enrolled) ids.add(e.studentId);
  for (const a of attended) ids.add(a.studentId);
  for (const r of examRows) {
    if (!semestersMatch(r.semester, cls.semester)) continue;
    if (otherClassThisTerm.has(r.studentId)) continue;
    ids.add(r.studentId);
  }
  return [...ids];
}

/** Prisma `where` fragment: match the historical roster, or nobody if empty. */
export async function classRosterStudentWhere(
  classId: number
): Promise<{ id: { in: number[] } }> {
  const ids = await findClassRosterStudentIds(classId);
  return { id: { in: ids.length > 0 ? ids : [-1] } };
}

/** Keep exam rows that belong to a class's term ("Semester 8" ≈ "Semester Eight"). */
export function examBelongsToClassTerm(
  record: { semester: string; year: number },
  cls: { semester: string; year: number }
): boolean {
  return record.year === cls.year && semestersMatch(record.semester, cls.semester);
}
