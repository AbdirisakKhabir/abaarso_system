import { prisma } from "@/lib/prisma";

type ClassWithDept = {
  id: number;
  name: string;
  semester: string;
  year: number;
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
  departmentId: string | null
): Promise<
  | { ok: true; classIds: number[]; scope: FinanceReportScope }
  | { ok: false; status: number; error: string }
> {
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
    select: { id: true, code: true, name: true },
  });

  if (!department) {
    return { ok: false, status: 404, error: "Department not found" };
  }

  const classes = await prisma.class.findMany({
    where: { departmentId: parsedDeptId, semester, year: parsedYear },
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
