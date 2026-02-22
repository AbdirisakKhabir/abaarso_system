import { prisma } from "@/lib/prisma";

/** Check if a semester name exists and is active in the system */
export async function isValidSemester(name: string): Promise<boolean> {
  const semester = await prisma.semester.findFirst({
    where: { name: String(name).trim(), isActive: true },
  });
  return !!semester;
}

/** Get all active semester names (for building lists like "all semesters for year") */
export async function getActiveSemesterNames(): Promise<string[]> {
  const semesters = await prisma.semester.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  return semesters.map((s) => s.name);
}
