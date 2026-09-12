import { prisma } from "@/lib/prisma";

/** Generate a unique student ID like STD-2026-0001. */
export async function generateStudentId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;

  const lastStudent = await prisma.student.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: "desc" },
  });

  let nextNum = 1;
  if (lastStudent) {
    const lastNum = parseInt(lastStudent.studentId.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}
