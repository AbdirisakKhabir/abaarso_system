import { prisma } from "@/lib/prisma";

/**
 * Reconstruct StudentEnrollment history from existing data so per-term reports
 * are correct even for students who were already upgraded before history
 * tracking existed.
 *
 * Signals, strongest first (higher priority wins for the same term):
 *  4. Current Student.classId           (concrete class)
 *  3. Attendance records in a class      (concrete class — recovers unpaid students)
 *  2. Exam records (student, sem, year)  (class resolved by dept+sem+year if unique)
 *  1. Tuition payments (student, sem, yr)(class resolved by dept+sem+year if unique)
 *
 * Idempotent: safe to run multiple times.
 */
export async function backfillEnrollments(): Promise<{
  scanned: {
    students: number;
    attendanceClasses: number;
    examRecords: number;
    payments: number;
  };
  written: number;
}> {
  const SEMESTER_WORDS: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
    seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  };
  const normSem = (s: string) => {
    let out = String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    for (const [w, n] of Object.entries(SEMESTER_WORDS)) {
      out = out.replace(new RegExp(`\\b${w}\\b`, "g"), n);
    }
    return out.replace(/[^a-z0-9]/g, "");
  };

  type Row = {
    studentId: number;
    classId: number | null;
    departmentId: number;
    program: string;
    semester: string;
    year: number;
    priority: number;
  };

  const acc = new Map<string, Row>();
  const key = (studentId: number, semester: string, year: number) =>
    `${studentId}|${normSem(semester)}|${year}`;

  const consider = (row: Row) => {
    const k = key(row.studentId, row.semester, row.year);
    const cur = acc.get(k);
    if (!cur) {
      acc.set(k, row);
      return;
    }
    const better =
      row.priority > cur.priority ||
      (row.priority === cur.priority && row.classId != null && cur.classId == null);
    if (better) acc.set(k, row);
  };

  // Class metadata + lookup for resolving exam/payment terms to a class.
  const classes = await prisma.class.findMany({
    select: { id: true, semester: true, year: true, departmentId: true, program: true },
  });
  const classMeta = new Map(classes.map((c) => [c.id, c]));
  const classByTerm = new Map<string, number | null>(); // unique => id, ambiguous => null
  for (const c of classes) {
    const tk = `${c.departmentId}|${normSem(c.semester)}|${c.year}|${c.program}`;
    classByTerm.set(tk, classByTerm.has(tk) ? null : c.id);
  }

  // 1. Current enrollment
  const currentStudents = await prisma.student.findMany({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  });
  for (const s of currentStudents) {
    const c = s.classId != null ? classMeta.get(s.classId) : null;
    if (!c) continue;
    consider({
      studentId: s.id,
      classId: c.id,
      departmentId: c.departmentId,
      program: c.program,
      semester: c.semester,
      year: c.year,
      priority: 4,
    });
  }

  // 2. Attendance (concrete class membership — recovers upgraded unpaid students)
  for (const c of classes) {
    const recs = await prisma.attendanceRecord.findMany({
      where: { session: { classId: c.id } },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    for (const r of recs) {
      consider({
        studentId: r.studentId,
        classId: c.id,
        departmentId: c.departmentId,
        program: c.program,
        semester: c.semester,
        year: c.year,
        priority: 3,
      });
    }
  }

  // 3. Exam records
  const exams = await prisma.examRecord.findMany({
    select: {
      studentId: true,
      semester: true,
      year: true,
      course: { select: { departmentId: true, program: true } },
    },
  });
  for (const e of exams) {
    const deptId = e.course.departmentId;
    const program = e.course.program;
    const tk = `${deptId}|${normSem(e.semester)}|${e.year}|${program}`;
    const resolved = classByTerm.get(tk);
    const cls = resolved != null ? classMeta.get(resolved) : null;
    consider({
      studentId: e.studentId,
      classId: cls?.id ?? null,
      departmentId: deptId,
      program,
      semester: cls?.semester ?? e.semester,
      year: e.year,
      priority: 2,
    });
  }

  // 4. Tuition payments
  const payments = await prisma.tuitionPayment.findMany({
    select: {
      studentId: true,
      semester: true,
      year: true,
      student: { select: { departmentId: true, program: true } },
    },
  });
  for (const p of payments) {
    const deptId = p.student.departmentId;
    const program = p.student.program;
    const tk = `${deptId}|${normSem(p.semester)}|${p.year}|${program}`;
    const resolved = classByTerm.get(tk);
    const cls = resolved != null ? classMeta.get(resolved) : null;
    consider({
      studentId: p.studentId,
      classId: cls?.id ?? null,
      departmentId: deptId,
      program,
      semester: cls?.semester ?? p.semester,
      year: p.year,
      priority: 1,
    });
  }

  let written = 0;
  for (const row of acc.values()) {
    await prisma.studentEnrollment.upsert({
      where: {
        studentId_semester_year: {
          studentId: row.studentId,
          semester: row.semester,
          year: row.year,
        },
      },
      create: {
        studentId: row.studentId,
        classId: row.classId,
        departmentId: row.departmentId,
        program: row.program,
        semester: row.semester,
        year: row.year,
      },
      update: {
        // Only fill in a concrete class if we didn't have one before.
        ...(row.classId != null ? { classId: row.classId } : {}),
        departmentId: row.departmentId,
        program: row.program,
      },
    });
    written += 1;
  }

  return {
    scanned: {
      students: currentStudents.length,
      attendanceClasses: classes.length,
      examRecords: exams.length,
      payments: payments.length,
    },
    written,
  };
}
