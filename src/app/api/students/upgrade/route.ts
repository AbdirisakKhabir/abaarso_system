import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Upgrade students to another semester/class.
 * - Class upgrade: all students in a class move to target class
 * - Single student: one student moves to target class
 *
 * Body: { classId?, studentId?, targetClassId }
 * Either (classId + targetClassId) OR (studentId + targetClassId) is required.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { classId, studentId, targetClassId } = body;

    const targetId = targetClassId != null ? Number(targetClassId) : null;
    if (!targetId || !Number.isInteger(targetId)) {
      return NextResponse.json(
        { error: "Target class (targetClassId) is required" },
        { status: 400 }
      );
    }

    const targetClass = await prisma.class.findUnique({
      where: { id: targetId },
      include: {
        course: { select: { departmentId: true } },
      },
    });

    if (!targetClass || !targetClass.isActive) {
      return NextResponse.json({ error: "Target class not found or inactive" }, { status: 404 });
    }

    let studentIds: number[] = [];

    if (classId != null && studentId == null) {
      // Class upgrade: all students in the class
      const sourceId = Number(classId);
      if (!Number.isInteger(sourceId)) {
        return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
      }

      const students = await prisma.student.findMany({
        where: { classId: sourceId, status: "Admitted" },
        select: { id: true, departmentId: true },
      });

      if (students.length === 0) {
        return NextResponse.json(
          { error: "No admitted students in this class to upgrade" },
          { status: 400 }
        );
      }

      // Target class must be in same department for class upgrade (same course track)
      const deptMismatch = students.some((s) => s.departmentId !== targetClass.course.departmentId);
      if (deptMismatch) {
        return NextResponse.json(
          { error: "Target class must be in the same department as the students" },
          { status: 400 }
        );
      }

      studentIds = students.map((s) => s.id);
    } else if (studentId != null && classId == null) {
      // Single student upgrade
      const sid = Number(studentId);
      if (!Number.isInteger(sid)) {
        return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
      }

      const student = await prisma.student.findUnique({
        where: { id: sid },
      });

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      if (student.status !== "Admitted") {
        return NextResponse.json(
          { error: "Only admitted students can be upgraded" },
          { status: 400 }
        );
      }

      // For single student, allow cross-department if target class's department matches
      if (student.departmentId !== targetClass.course.departmentId) {
        return NextResponse.json(
          { error: "Target class must be in the student's department" },
          { status: 400 }
        );
      }

      studentIds = [sid];
    } else {
      return NextResponse.json(
        { error: "Provide either (classId + targetClassId) for class upgrade, or (studentId + targetClassId) for single student upgrade" },
        { status: 400 }
      );
    }

    const result = await prisma.student.updateMany({
      where: { id: { in: studentIds } },
      data: { classId: targetId },
    });

    return NextResponse.json({
      upgraded: result.count,
      targetClass: {
        id: targetClass.id,
        name: targetClass.name,
        semester: targetClass.semester,
        year: targetClass.year,
      },
    });
  } catch (e) {
    console.error("Upgrade students error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
