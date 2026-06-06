import { prisma } from "@/lib/prisma";
import { isAdminRoleName } from "@/lib/permissions";

export async function userIsAdmin(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });
  return isAdminRoleName(user?.role?.name);
}

export async function getLecturerIdForUser(userId: number): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return null;

  const lecturer = await prisma.lecturer.findFirst({
    where: { email: user.email, isActive: true },
    select: { id: true },
  });
  return lecturer?.id ?? null;
}

export async function userCanManageAttendanceSession(
  userId: number,
  classId: number
): Promise<boolean> {
  if (await userIsAdmin(userId)) return true;

  const lecturerId = await getLecturerIdForUser(userId);
  if (!lecturerId) return false;

  const assignment = await prisma.attendanceTaker.findFirst({
    where: {
      classId,
      lecturerId,
      isActive: true,
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function assertUserCanManageAttendanceSession(
  userId: number,
  classId: number
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (await userIsAdmin(userId)) {
    return { ok: true };
  }

  const lecturerId = await getLecturerIdForUser(userId);
  if (!lecturerId) {
    return {
      ok: false,
      error:
        "Your account is not linked to an active lecturer profile. Contact an administrator.",
      status: 403,
    };
  }

  const assignment = await prisma.attendanceTaker.findFirst({
    where: {
      classId,
      lecturerId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!assignment) {
    return {
      ok: false,
      error: "You are not assigned to take or edit attendance for this class.",
      status: 403,
    };
  }

  return { ok: true };
}

export async function validateAttendanceTakerAssignment(input: {
  classId: number;
  lecturerId: number;
  excludeId?: number;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { classId, lecturerId, excludeId } = input;

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, isActive: true },
  });
  if (!cls || !cls.isActive) {
    return { ok: false, error: "Class not found or inactive", status: 404 };
  }

  const lecturer = await prisma.lecturer.findUnique({
    where: { id: lecturerId },
    select: { id: true, isActive: true },
  });
  if (!lecturer || !lecturer.isActive) {
    return { ok: false, error: "Lecturer not found or inactive", status: 404 };
  }

  const conflict = await prisma.attendanceTaker.findFirst({
    where: {
      classId,
      lecturerId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    return {
      ok: false,
      error: "This lecturer is already assigned to this class.",
      status: 400,
    };
  }

  return { ok: true };
}
