import { prisma } from "@/lib/prisma";
import { DEFAULT_PROGRAM, parseProgram, type Program } from "@/lib/program";

type ClassWithDept = {
  id: number;
  name: string;
  semester: string;
  year: number;
  program?: string;
  department: { id: number; code: string; name: string; tuitionFee: number | null };
};

export type FinanceReportScope =
  | { mode: "class"; class: ClassWithDept }
  | {
      mode: "department";
      department: { id: number; code: string; name: string };
      classes: ClassWithDept[];
    };

export async function resolveFinanceReportScope(
  semester: string,
  year: number,
  classId: string | null,
  departmentId: string | null,
  program?: string | null
): Promise<
  | { ok: true; classIds: number[]; scope: FinanceReportScope; program: Program }
  | { ok: false; status: number; error: string }
> {
  const resolvedProgram =
    (parseProgram(program) as Program | null) ?? DEFAULT_PROGRAM;
  const parsedYear = year;
  const parsedDeptId = departmentId ? Number(departmentId) : null;
  const allClassesInDept = classId === "all";

  if (classId && classId !== "all") {
    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId)) {
      return { ok: false, status: 400, error: "Invalid classId" };
    }

    const cls = await prisma.class.findUnique({
      where: { id: parsedClassId },
      include: {
        department: { select: { id: true, code: true, name: true, tuitionFee: true } },
      },
    });

    if (!cls) {
      return { ok: false, status: 404, error: "Class not found" };
    }

    if (cls.program !== resolvedProgram) {
      return {
        ok: false,
        status: 400,
        error: "Selected class does not belong to the chosen program",
      };
    }

    if (cls.semester !== semester || cls.year !== parsedYear) {
      return {
        ok: false,
        status: 400,
        error: "Class semester/year does not match the selected semester and year",
      };
    }

    if (parsedDeptId && cls.department.id !== parsedDeptId) {
      return {
        ok: false,
        status: 400,
        error: "Selected class does not belong to the chosen department",
      };
    }

    return {
      ok: true,
      classIds: [cls.id],
      scope: { mode: "class", class: cls },
      program: resolvedProgram,
    };
  }

  if (!parsedDeptId || !Number.isInteger(parsedDeptId)) {
    return {
      ok: false,
      status: 400,
      error: "departmentId is required when listing all classes in a department",
    };
  }

  const department = await prisma.department.findUnique({
    where: { id: parsedDeptId },
    select: { id: true, code: true, name: true, program: true },
  });

  if (!department) {
    return { ok: false, status: 404, error: "Department not found" };
  }

  if (department.program !== resolvedProgram) {
    return {
      ok: false,
      status: 400,
      error: "Selected department does not belong to the chosen program",
    };
  }

  const classes = await prisma.class.findMany({
    where: {
      departmentId: parsedDeptId,
      semester,
      year: parsedYear,
      program: resolvedProgram,
    },
    include: {
      department: { select: { id: true, code: true, name: true, tuitionFee: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  if (classes.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "No classes found for this department, semester, and year",
    };
  }

  if (!allClassesInDept) {
    return {
      ok: false,
      status: 400,
      error: "classId is required, or use classId=all with departmentId",
    };
  }

  return {
    ok: true,
    classIds: classes.map((c) => c.id),
    scope: { mode: "department", department, classes },
    program: resolvedProgram,
  };
}

export function financeReportMeta(scope: FinanceReportScope) {
  if (scope.mode === "class") {
    return {
      scope: "class" as const,
      class: {
        id: scope.class.id,
        name: scope.class.name,
        semester: scope.class.semester,
        year: scope.class.year,
        department: scope.class.department,
      },
    };
  }

  return {
    scope: "department" as const,
    department: scope.department,
    classes: scope.classes.map((c) => ({
      id: c.id,
      name: c.name,
      semester: c.semester,
      year: c.year,
    })),
  };
}

const financeStudentInclude = {
  department: { select: { id: true, name: true, code: true, tuitionFee: true } },
  class: { select: { id: true, name: true, department: { select: { code: true } } } },
  tuitionPayments: {
    select: { id: true, amount: true, semester: true, year: true },
  },
} as const;

/** Normalize semester labels so "Semester Eight" and "Semester 8" match. */
export function normalizeSemesterKey(semester: string): string {
  const raw = String(semester ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const words: Record<string, string> = {
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
  let out = raw;
  for (const [word, num] of Object.entries(words)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }
  return out.replace(/[^a-z0-9]/g, "");
}

export function semestersMatch(a: string, b: string): boolean {
  const left = String(a ?? "").trim().toLowerCase();
  const right = String(b ?? "").trim().toLowerCase();
  if (left === right) return true;
  return normalizeSemesterKey(a) === normalizeSemesterKey(b);
}

/**
 * Load students for paid/unpaid term reports after class upgrades.
 *
 * Cohort is based on tuition payments for the selected semester/year in the
 * department (students may already have moved to a newer class). Currently
 * enrolled students in the selected class(es) are always included too.
 */
export async function findStudentsForFinanceTermReport(
  resolved: { classIds: number[]; scope: FinanceReportScope; program: Program },
  semester: string,
  year: number
): Promise<{
  students: Array<{
    id: number;
    studentId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    paymentStatus: string | null;
    customSemesterFee: number | null;
    department: { id: number; name: string; code: string; tuitionFee: number | null };
    class: { id: number; name: string; department: { code: string } } | null;
    tuitionPayments: { id: number; amount: number; semester: string; year: number }[];
  }>;
  source: "term_payments" | "class_enrollment" | "mixed" | "none";
}> {
  const departmentId =
    resolved.scope.mode === "class"
      ? resolved.scope.class.department.id
      : resolved.scope.department.id;

  const [yearPayments, enrolled] = await Promise.all([
    prisma.tuitionPayment.findMany({
      where: {
        year,
        student: {
          departmentId,
          status: { in: ["Admitted", "Graduated"] },
        },
      },
      select: { studentId: true, semester: true },
    }),
    prisma.student.findMany({
      where: {
        classId: { in: resolved.classIds },
        status: { in: ["Admitted", "Graduated"] },
      },
      select: { id: true },
    }),
  ]);

  const paymentStudentIds = new Set<number>();
  for (const p of yearPayments) {
    if (semestersMatch(p.semester, semester)) {
      paymentStudentIds.add(p.studentId);
    }
  }

  const enrolledIds = new Set(enrolled.map((s) => s.id));
  const allIds = [...new Set([...paymentStudentIds, ...enrolledIds])];

  if (allIds.length === 0) {
    return { students: [], source: "none" };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: allIds } },
    include: {
      ...financeStudentInclude,
      tuitionPayments: {
        where: { year },
        select: financeStudentInclude.tuitionPayments.select,
      },
    },
    orderBy: [{ studentId: "asc" }],
  });

  const source =
    paymentStudentIds.size > 0 && enrolledIds.size > 0
      ? ("mixed" as const)
      : paymentStudentIds.size > 0
        ? ("term_payments" as const)
        : ("class_enrollment" as const);

  return { students, source };
}

