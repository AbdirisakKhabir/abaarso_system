import { prisma } from "@/lib/prisma";
import { calculateGPA } from "@/lib/grades";
import { sortExamRecordsBySemesterChronologically } from "@/lib/semester-sort";

export type ExamRecordFilter = "approved" | "all";

const studentSelect = {
  id: true,
  studentId: true,
  firstName: true,
  lastName: true,
  imageUrl: true,
  admissionDate: true,
  department: {
    select: {
      id: true,
      name: true,
      code: true,
      faculty: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

/**
 * Load exam records + GPA for transcript / examination views.
 * @param examFilter — public callers should use "approved" only.
 */
export async function buildStudentAcademicReport(
  internalStudentId: number,
  examFilter: ExamRecordFilter = "all"
) {
  const student = await prisma.student.findUnique({
    where: { id: internalStudentId },
    select: studentSelect,
  });

  if (!student) return null;

  const recordsRaw = await prisma.examRecord.findMany({
    where: {
      studentId: internalStudentId,
      ...(examFilter === "approved" ? { status: "approved" } : {}),
    },
    include: {
      course: {
        select: { id: true, name: true, code: true, creditHours: true },
      },
    },
  });

  const semesters = await prisma.semester.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { name: true, sortOrder: true },
  });
  const semOrderMap = semesters.reduce<Record<string, number>>((acc, s, i) => {
    acc[s.name] = s.sortOrder ?? i;
    return acc;
  }, {});

  const records = sortExamRecordsBySemesterChronologically(
    recordsRaw,
    semOrderMap
  );

  const gpaData = calculateGPA(
    records.map((r) => ({
      semester: r.semester,
      year: r.year,
      gradePoints: r.gradePoints,
      creditHours: r.course.creditHours,
    })),
    semOrderMap
  );

  return {
    student,
    records,
    gpa: gpaData,
    semesterSortMap: semOrderMap,
  };
}

/** Resolve URL param: institutional `studentId` string or numeric internal id. */
export async function resolveStudentInternalId(
  param: string
): Promise<number | null> {
  const trimmed = param.trim();
  if (!trimmed) return null;

  const byCode = await prisma.student.findFirst({
    where: {
      studentId: trimmed,
      status: { in: ["Admitted", "Graduated"] },
    },
    select: { id: true },
  });
  if (byCode) return byCode.id;

  const n = Number(trimmed);
  if (Number.isInteger(n) && n > 0) {
    const byPk = await prisma.student.findFirst({
      where: {
        id: n,
        status: { in: ["Admitted", "Graduated"] },
      },
      select: { id: true },
    });
    if (byPk) return byPk.id;
  }

  return null;
}
