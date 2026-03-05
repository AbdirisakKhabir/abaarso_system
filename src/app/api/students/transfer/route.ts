import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Transfer a student to another department and/or class.
 * Body: { studentId, departmentId?, classId? }
 * At least one of departmentId or classId must be provided.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, departmentId, classId } = body;

    const sid = studentId != null ? Number(studentId) : null;
    if (!sid || !Number.isInteger(sid)) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    if (!departmentId && !classId) {
      return NextResponse.json(
        { error: "Provide at least departmentId or classId to transfer" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: sid },
      include: {
        department: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, semester: true, year: true, department: { select: { code: true } } } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (student.status !== "Admitted") {
      return NextResponse.json(
        { error: "Only admitted students can be transferred" },
        { status: 400 }
      );
    }

    const data: { departmentId?: number; classId?: number | null } = {};

    if (departmentId != null) {
      const did = Number(departmentId);
      if (!Number.isInteger(did)) {
        return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
      }
      const dept = await prisma.department.findUnique({ where: { id: did } });
      if (!dept?.isActive) {
        return NextResponse.json({ error: "Department not found or inactive" }, { status: 404 });
      }
      data.departmentId = did;
      // When changing department, clear class (class belongs to course which belongs to department)
      data.classId = null;
    }

    if (classId != null) {
      const cid = classId === "" || classId === null ? null : Number(classId);
      if (cid !== null) {
        if (!Number.isInteger(cid)) {
          return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
        }
        const cls = await prisma.class.findUnique({
          where: { id: cid },
          include: { department: { select: { id: true } } },
        });
        if (!cls?.isActive) {
          return NextResponse.json({ error: "Class not found or inactive" }, { status: 404 });
        }
        const effectiveDeptId = data.departmentId ?? student.departmentId;
        if (cls.department.id !== effectiveDeptId) {
          return NextResponse.json(
            { error: "Selected class must belong to the student's department" },
            { status: 400 }
          );
        }
        data.classId = cid;
      } else {
        data.classId = null;
      }
    }

    const updated = await prisma.student.update({
      where: { id: sid },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            department: { select: { code: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Transfer student error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
