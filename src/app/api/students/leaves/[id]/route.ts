import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseLeaveFormBody,
  syncAttendanceForLeave,
  syncLeaveOnStatusChange,
} from "@/lib/student-leave";
import { parseStudentStatus } from "@/lib/student-status";
import { logActivity } from "@/lib/activity-log";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH — return from leave (sets endDate and status, default Admitted)
 * { endDate?, status? }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid leave ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const endDate = body.endDate ? new Date(body.endDate) : new Date();
    if (body.endDate && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
    }
    const nextStatus = parseStudentStatus(body.status ?? "Admitted", "Admitted");
    if (nextStatus === "Leave") {
      return NextResponse.json({ error: "Choose a status other than Leave to return the student." }, { status: 400 });
    }

    const leave = await prisma.studentLeave.findUnique({
      where: { id },
      include: { student: { select: { id: true, studentId: true, status: true } } },
    });
    if (!leave) return NextResponse.json({ error: "Leave record not found" }, { status: 404 });
    if (leave.endDate) {
      return NextResponse.json({ error: "This leave has already ended." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: leave.studentId },
        data: { status: nextStatus },
      });
      await syncLeaveOnStatusChange(tx, {
        studentId: leave.studentId,
        previousStatus: leave.student.status,
        nextStatus,
        endDate,
        recordedById: auth.userId,
      });
    });

    await logActivity({
      userId: auth.userId,
      action: "student.leave.return",
      module: "admission",
      summary: `Returned ${leave.student.studentId} from leave as ${nextStatus}`,
      metadata: { leaveId: id, studentId: leave.studentId, status: nextStatus },
      req,
    });

    const updated = await prisma.studentLeave.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ leave: updated });
  } catch (e) {
    console.error("student leave PATCH error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * PUT — edit the Student Leave Form details of a leave (type, dates, reason,
 * contacts, document, approver). Re-applies Present attendance for the period.
 */
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid leave ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = parseLeaveFormBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const form = parsed.data;

    const leave = await prisma.studentLeave.findUnique({
      where: { id },
      include: { student: { select: { id: true, studentId: true } } },
    });
    if (!leave) return NextResponse.json({ error: "Leave record not found" }, { status: 404 });

    const startDate = form.startDate ?? leave.startDate;
    if (form.expectedEndDate && form.expectedEndDate < startDate) {
      return NextResponse.json(
        { error: "End date of leave cannot be before the start date." },
        { status: 400 }
      );
    }

    const backfilled = await prisma.$transaction(async (tx) => {
      await tx.studentLeave.update({
        where: { id },
        data: {
          startDate,
          expectedEndDate: form.expectedEndDate,
          leaveType: form.leaveType,
          leaveTypeOther: form.leaveTypeOther,
          reason: form.reason,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          parentPhone: form.parentPhone,
          documentUrl: form.documentUrl,
          documentPublicId: form.documentPublicId,
          declarationSigned: form.declarationSigned,
          approvedByName: form.approvedByName,
          approvalDate: form.approvalDate,
        },
      });
      return syncAttendanceForLeave(tx, id);
    });

    await logActivity({
      userId: auth.userId,
      action: "student.leave.update",
      module: "admission",
      summary: `Updated leave for ${leave.student.studentId}`,
      metadata: { leaveId: id, studentId: leave.studentId, attendanceSetPresent: backfilled },
      req,
    });

    const updated = await prisma.studentLeave.findUnique({ where: { id } });
    return NextResponse.json({ leave: updated, attendanceSetPresent: backfilled });
  } catch (e) {
    console.error("student leave PUT error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
