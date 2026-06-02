import { prisma } from "@/lib/prisma";
import { isAdminRoleName } from "@/lib/permissions";

export const ATTENDANCE_SHIFTS = ["Morning", "Afternoon", "Evening"] as const;

export type AttendanceShift = (typeof ATTENDANCE_SHIFTS)[number];

export function isValidAttendanceShift(shift: string): shift is AttendanceShift {
  return (ATTENDANCE_SHIFTS as readonly string[]).includes(shift);
}

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
  classId: number,
  courseId: number,
  shift: string
): Promise<boolean> {
  if (await userIsAdmin(userId)) return true;

  const lecturerId = await getLecturerIdForUser(userId);
  if (!lecturerId) return false;

  const assignment = await prisma.attendanceTaker.findFirst({
    where: {
      classId,
      courseId,
      shift,
      lecturerId,
      isActive: true,
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function assertUserCanManageAttendanceSession(
  userId: number,
  classId: number,
  courseId: number,
  shift: string
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
      courseId,
      shift,
      lecturerId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!assignment) {
    return {
      ok: false,
      error:
        "You are not assigned to take or edit attendance for this class, course, and shift.",
      status: 403,
    };
  }

  return { ok: true };
}

export async function validateAttendanceTakerAssignment(input: {
  classId: number;
  courseId: number;
  lecturerId: number;
  shift: string;
  excludeId?: number;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { classId, courseId, lecturerId, shift, excludeId } = input;

  if (!isValidAttendanceShift(shift)) {
    return {
      ok: false,
      error: "Shift must be Morning, Afternoon, or Evening",
      status: 400,
    };
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, departmentId: true, isActive: true },
  });
  if (!cls || !cls.isActive) {
    return { ok: false, error: "Class not found or inactive", status: 404 };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, departmentId: true, isActive: true },
  });
  if (!course || !course.isActive) {
    return { ok: false, error: "Course not found or inactive", status: 404 };
  }
  if (course.departmentId !== cls.departmentId) {
    return {
      ok: false,
      error: "Course must belong to the same department as the class.",
      status: 400,
    };
  }

  const lecturer = await prisma.lecturer.findUnique({
    where: { id: lecturerId },
    select: { id: true, isActive: true },
  });
  if (!lecturer || !lecturer.isActive) {
    return { ok: false, error: "Lecturer not found or inactive", status: 404 };
  }

  const teachesCourse = await prisma.lecturerCourse.findUnique({
    where: {
      lecturerId_courseId: { lecturerId, courseId },
    },
    select: { lecturerId: true },
  });
  if (!teachesCourse) {
    return {
      ok: false,
      error: "Selected lecturer is not assigned to teach this course.",
      status: 400,
    };
  }

  const conflict = await prisma.attendanceTaker.findFirst({
    where: {
      classId,
      courseId,
      shift,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    return {
      ok: false,
      error:
        "An attendance taker is already assigned for this class, course, and shift.",
      status: 400,
    };
  }

  return { ok: true };
}
