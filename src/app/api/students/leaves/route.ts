import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";
import {
  parseLeaveFormBody,
  syncAttendanceForLeave,
  syncLeaveOnStatusChange,
} from "@/lib/student-leave";
import { logActivity } from "@/lib/activity-log";

const leaveInclude = {
  student: {
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      parentPhone: true,
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
      ...(current ? { endDate: null, approvalStatus: "Approved" } : {}),
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
 * POST — record a Student Leave Form
 * { studentId (internal or STD-…), leaveType?, leaveTypeOther?, startDate?, expectedEndDate?,
 *   reason?, contactEmail?, contactPhone?, parentPhone?, documentUrl?, documentPublicId?,
 *   declarationSigned?, approved? (default true), approvedByName?, approvalDate? }
 * Approved → student status becomes Leave and attendance inside the period is set to Present.
 * Not approved → kept in history as Rejected; the student's status is unchanged.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rawId = body.studentId;
    const parsed = parseLeaveFormBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const form = parsed.data;
    const approved = body.approved !== false;
    const startDate = form.startDate ?? new Date();

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

    const details = {
      leaveType: form.leaveType,
      leaveTypeOther: form.leaveTypeOther,
      expectedEndDate: form.expectedEndDate,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      parentPhone: form.parentPhone,
      documentUrl: form.documentUrl,
      documentPublicId: form.documentPublicId,
      declarationSigned: form.declarationSigned,
      approvedByName: form.approvedByName,
      approvalDate: form.approvalDate,
    };

    const { leaveId, backfilled } = await prisma.$transaction(async (tx) => {
      if (!approved) {
        // Rejected requests are closed immediately so they never count as an open leave.
        const row = await tx.studentLeave.create({
          data: {
            studentId: student.id,
            startDate,
            endDate: new Date(),
            reason: form.reason,
            recordedById: auth.userId,
            approvalStatus: "Rejected",
            ...details,
          },
        });
        return { leaveId: row.id, backfilled: 0 };
      }

      await tx.student.update({
        where: { id: student.id },
        data: {
          status: "Leave",
          ...(!student.parentPhone && form.parentPhone ? { parentPhone: form.parentPhone } : {}),
        },
      });
      await syncLeaveOnStatusChange(tx, {
        studentId: student.id,
        previousStatus: student.status,
        nextStatus: "Leave",
        startDate,
        reason: form.reason,
        recordedById: auth.userId,
      });
      const open = await tx.studentLeave.findFirstOrThrow({
        where: { studentId: student.id, endDate: null },
        select: { id: true },
      });
      await tx.studentLeave.update({
        where: { id: open.id },
        data: { ...details, approvalStatus: "Approved" },
      });
      const count = await syncAttendanceForLeave(tx, open.id);
      return { leaveId: open.id, backfilled: count };
    });

    await logActivity({
      userId: auth.userId,
      action: approved ? "student.leave" : "student.leave.rejected",
      module: "admission",
      summary: approved
        ? `Put ${student.studentId} on leave`
        : `Recorded rejected leave request for ${student.studentId}`,
      metadata: {
        studentId: student.id,
        leaveId,
        leaveType: form.leaveType,
        reason: form.reason,
        attendanceSetPresent: backfilled,
      },
      req,
    });

    const leave = await prisma.studentLeave.findUnique({
      where: { id: leaveId },
      include: leaveInclude,
    });

    return NextResponse.json({ leave, attendanceSetPresent: backfilled });
  } catch (e) {
    console.error("student leaves POST error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
