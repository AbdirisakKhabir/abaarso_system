import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateStudentId } from "@/lib/student-id";
import { perSemesterTuition, PAYMENT_STATUSES } from "@/lib/tuition-amount";
import { recordEnrollmentForClass } from "@/lib/enrollment";
import { recordTuitionChargeForClass } from "@/lib/tuition-charge";
import { logActivity } from "@/lib/activity-log";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/online-registrations/:id/approve
 * Body: { paymentStatus, customSemesterFee?, classId? }
 * Creates the Student record and marks the registration Approved.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const check = await requirePermission(req, "admission.create");
    if ("error" in check) return check.error;
    const { auth } = check;

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid registration ID" }, { status: 400 });
    }

    const registration = await prisma.onlineRegistration.findUnique({
      where: { id },
      include: { department: { select: { id: true, tuitionFee: true } } },
    });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (registration.status !== "Pending") {
      return NextResponse.json(
        { error: `This application was already ${registration.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const paymentStatus = (PAYMENT_STATUSES as readonly string[]).includes(body.paymentStatus)
      ? body.paymentStatus
      : "Fully Paid";

    const customSemesterFee =
      body.customSemesterFee == null || String(body.customSemesterFee).trim() === ""
        ? null
        : Number(body.customSemesterFee);
    if (customSemesterFee != null && (!Number.isFinite(customSemesterFee) || customSemesterFee < 0)) {
      return NextResponse.json({ error: "Fee must be a non-negative number" }, { status: 400 });
    }

    let classId: number | null = null;
    if (body.classId != null && String(body.classId).trim() !== "") {
      const n = Number(body.classId);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid class" }, { status: 400 });
      }
      const cls = await prisma.class.findUnique({
        where: { id: n },
        select: { id: true, departmentId: true, program: true },
      });
      if (!cls || cls.departmentId !== registration.departmentId || cls.program !== registration.program) {
        return NextResponse.json(
          { error: "Selected class does not belong to this applicant's department/program" },
          { status: 400 }
        );
      }
      classId = cls.id;
    }

    if (registration.email) {
      const existing = await prisma.student.findUnique({
        where: { email: registration.email },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A student with this email already exists" },
          { status: 400 }
        );
      }
    }

    const studentId = await generateStudentId();
    const balance = perSemesterTuition(
      registration.department.tuitionFee ?? 0,
      paymentStatus,
      customSemesterFee
    );

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          studentId,
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          phone: registration.phone,
          dateOfBirth: registration.dateOfBirth,
          gender: registration.gender,
          address: registration.address,
          departmentId: registration.departmentId,
          classId,
          program: registration.program,
          status: "Admitted",
          paymentStatus,
          customSemesterFee,
          balance,
        },
        include: {
          department: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true, semester: true, year: true } },
        },
      });

      await tx.onlineRegistration.update({
        where: { id: registration.id },
        data: {
          status: "Approved",
          paymentStatus,
          customSemesterFee,
          classId,
          studentId: created.id,
          reviewedById: auth.userId,
          reviewedAt: new Date(),
        },
      });

      await recordEnrollmentForClass(tx, created.id, classId);
      if (balance > 0) {
        await recordTuitionChargeForClass(tx, {
          studentId: created.id,
          classId,
          amount: balance,
          chargedById: auth.userId,
          note: "Online registration",
        });
      }

      return created;
    });

    await logActivity({
      userId: auth.userId,
      action: "online_registration.approve",
      module: "admission",
      summary: `Approved online registration for ${registration.firstName} ${registration.lastName} → ${student.studentId}`,
      metadata: { registrationId: registration.id, studentId: student.id },
      req,
    });

    return NextResponse.json({ student });
  } catch (e) {
    console.error("online-registrations approve error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
