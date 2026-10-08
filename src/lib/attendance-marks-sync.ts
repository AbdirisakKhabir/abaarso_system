import { prisma } from "@/lib/prisma";
import { computeAttendanceMarks } from "@/lib/attendance";
import { getGradeInfo } from "@/lib/grades";
import { semestersMatch } from "@/lib/semester-match";

export type AttendanceMarksChange = {
  examRecordId: number;
  student: string;
  course: string;
  className: string;
  term: string;
  attendanceMarks: number;
  oldTotal: number;
  newTotal: number;
  oldGrade: string | null;
  newGrade: string | null;
  gradeKept: boolean;
};

/**
 * Repair exam results saved with a missing attendance mark.
 *
 * The exam "Attend" column (ExamRecord.presentation, out of 10) is prefilled
 * from attendance. Reports used to drop sessions outside a calendar range
 * guessed from the class semester name, so some classes (e.g. "Semester Five")
 * got 0 and were saved that way.
 *
 * Only records whose attendance mark is 0/empty while attendance gives > 0 are
 * changed — marks typed by a lecturer are never overwritten. The total grows by
 * the attendance mark; the grade is recomputed unless it was set manually.
 * Idempotent: a second run finds nothing to change.
 */
export async function syncMissingAttendanceMarks(opts: {
  classId?: number;
  courseId?: number;
  dryRun?: boolean;
}): Promise<{ scannedClassCourses: number; changes: AttendanceMarksChange[] }> {
  const pairs = await prisma.attendanceSession.groupBy({
    by: ["classId", "courseId"],
    where: {
      ...(opts.classId ? { classId: opts.classId } : {}),
      ...(opts.courseId ? { courseId: opts.courseId } : {}),
    },
  });

  const changes: AttendanceMarksChange[] = [];

  for (const { classId, courseId } of pairs) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { name: true, semester: true, year: true },
    });
    if (!cls) continue;

    const sessions = await prisma.attendanceSession.findMany({
      where: { classId, courseId },
      select: { id: true },
    });
    const totalSessions = sessions.length;
    if (totalSessions === 0) continue;

    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      select: { studentId: true, status: true },
    });
    const attended = new Map<number, number>();
    for (const r of records) {
      const hit = r.status === "Present" || r.status === "Excused" ? 1 : 0;
      attended.set(r.studentId, (attended.get(r.studentId) ?? 0) + hit);
    }

    const exams = await prisma.examRecord.findMany({
      where: {
        courseId,
        year: cls.year,
        studentId: { in: [...attended.keys()] },
        OR: [{ presentation: null }, { presentation: 0 }],
      },
      include: {
        student: { select: { studentId: true } },
        course: { select: { code: true } },
      },
    });

    for (const exam of exams) {
      if (!semestersMatch(exam.semester, cls.semester)) continue;
      const marks = computeAttendanceMarks(attended.get(exam.studentId) ?? 0, totalSessions);
      if (marks <= 0) continue;

      const oldTotal = exam.totalMarks ?? 0;
      const newTotal = Math.round(Math.min(100, oldTotal + marks) * 100) / 100;
      // Keep a grade that was set by hand (doesn't match the old total).
      const gradeWasComputed = !exam.grade || getGradeInfo(oldTotal).grade === exam.grade;
      const info = getGradeInfo(newTotal);

      changes.push({
        examRecordId: exam.id,
        student: exam.student.studentId,
        course: exam.course.code,
        className: cls.name,
        term: `${cls.semester} ${cls.year}`,
        attendanceMarks: marks,
        oldTotal,
        newTotal,
        oldGrade: exam.grade,
        newGrade: gradeWasComputed ? info.grade : exam.grade,
        gradeKept: !gradeWasComputed,
      });

      if (!opts.dryRun) {
        await prisma.examRecord.update({
          where: { id: exam.id },
          data: {
            presentation: marks,
            totalMarks: newTotal,
            ...(gradeWasComputed ? { grade: info.grade, gradePoints: info.gradePoints } : {}),
          },
        });
      }
    }
  }

  return { scannedClassCourses: pairs.length, changes };
}
