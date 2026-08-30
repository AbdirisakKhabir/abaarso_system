import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";
import { syncLeaveOnStatusChange } from "@/lib/student-leave";
import { logActivity } from "@/lib/activity-log";

const leaveInclude = {
  student: {
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      program: true,
      department: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true, semester: true, year: true } },
    },
  },
  recordedBy: { select: { id: true, name: true, email: true } },
} as const;

/**
 * GET /api/students/leaves
 * current=true (default) — students currently on leave
 * current=false — full leave history
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const current = searchParams.get("current") !== "false";
    const q = searchParams.get("q")?.trim() || "";
    const departmentId = Number(searchParams.get("departmentId"));
    const program = parseProgram(searchParams.get("program"), { allowAll: true });

    const studentWhere: Prisma.StudentWhereInput = {};
    if (program && program !== "all") studentWhere.program = program;
    if (Number.isInteger(departmentId) && departmentId > 0) {
      studentWhere.departmentId = departmentId;
    }
    if (q) {
      studentWhere.OR = [
        { studentId: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const where: Prisma.StudentLeaveWhereInput = {
      ...(current ? { endDate: null } : {}),
      ...(Object.keys(studentWhere).length > 0 ? { student: studentWhere } : {}),
    };

    const [leaves, currentCount] = await Promise.all([
      prisma.studentLeave.findMany({
        where,
        include: leaveInclude,
        orderBy: [{ startDate: "desc" }, { id: "desc" }],
      }),
      prisma.student.count({
        where: {
          status: "Leave",
          ...(program && program !== "all" ? { program } : {}),
        },
      }),
    ]);

    return NextResponse.json({ leaves, currentCount });
  } catch (e) {
    console.error("student leaves GET error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * POST — put a student on leave
 * { studentId (internal or STD-…), startDate?, reason? }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rawId = body.studentId;
    const reason = body.reason != null ? String(body.reason).trim() : "";
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    if (body.startDate && Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    }

    const student =
      typeof rawId === "number" || (typeof rawId === "string" && /^\d+$/.test(rawId))
        ? await prisma.student.findUnique({ where: { id: Number(rawId) } })
        : await prisma.student.findUnique({ where: { studentId: String(rawId ?? "").trim() } });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (student.status === "Leave") {
      return NextResponse.json({ error: "This student is already on leave." }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.student.update({
        where: { id: student.id },
        data: { status: "Leave" },
      });
      await syncLeaveOnStatusChange(tx, {
        studentId: student.id,
        previousStatus: student.status,
        nextStatus: "Leave",
        startDate,
        reason,
        recordedById: auth.userId,
      });
      return row;
    });

    await logActivity({
      userId: auth.userId,
      action: "student.leave",
      module: "admission",
      summary: `Put ${student.studentId} on leave`,
      metadata: { studentId: student.id, reason },
      req,
    });

    const leave = await prisma.studentLeave.findFirst({
      where: { studentId: updated.id, endDate: null },
      include: leaveInclude,
    });

    return NextResponse.json({ student: updated, leave });
  } catch (e) {
    console.error("student leaves POST error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
