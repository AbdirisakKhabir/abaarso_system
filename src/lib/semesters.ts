import { prisma } from "@/lib/prisma";
import type { Program } from "@/lib/program";

/** Check if a semester name exists and is active (optionally for a program) */
export async function isValidSemester(
  name: string,
  program?: Program | string | null
): Promise<boolean> {
  const semester = await prisma.semester.findFirst({
    where: {
      name: String(name).trim(),
      isActive: true,
      ...(program ? { program: String(program) } : {}),
    },
  });
  return !!semester;
}

/** Get all active semester names (for building lists like "all semesters for year") */
export async function getActiveSemesterNames(
  program?: Program | string | null
): Promise<string[]> {
  const semesters = await prisma.semester.findMany({
    where: {
      isActive: true,
      ...(program ? { program: String(program) } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  return semesters.map((s) => s.name);
}
