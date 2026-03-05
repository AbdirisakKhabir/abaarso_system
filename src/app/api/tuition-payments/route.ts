import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSemester } from "@/lib/semesters";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId"); // studentId string e.g. STD-2026-0001
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");

    const where: { student?: { studentId?: string }; semester?: string; year?: number } = {};
    if (studentId) {
      where.student = { studentId: String(studentId) };
    }
    if (semester) where.semester = semester;
    if (year) where.year = Number(year);

    const payments = await prisma.tuitionPayment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true, semester: true, year: true, department: { select: { code: true } } } },
          },
        },
        bank: { select: { id: true, name: true, code: true } },
        recordedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { paidAt: "desc" }],
    });

    return NextResponse.json(payments);
  } catch (e) {
    console.error("Tuition payments list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      studentId: studentIdStr,
      amount,
      semester,
      year,
      note,
      bankId,
      paymentMethod,
      receiptNumber,
      transactionId,
      paymentDate,
    } = body;

    if (!studentIdStr || !semester || !year) {
      return NextResponse.json(
        { error: "Student ID, semester, and year are required" },
        { status: 400 }
      );
    }

    if (!bankId) {
      return NextResponse.json(
        { error: "Bank is required for recording deposits" },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.findUnique({
      where: { id: Number(bankId) },
    });
    if (!bank || !bank.isActive) {
      return NextResponse.json({ error: "Invalid or inactive bank" }, { status: 400 });
    }

    if (!(await isValidSemester(semester))) {
      return NextResponse.json(
        { error: "Invalid semester. Use a semester from the Semesters settings." },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { studentId: String(studentIdStr).trim() },
      include: { department: { select: { tuitionFee: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const amt = amount != null ? Number(amount) : (student.department.tuitionFee ?? 0);
    if (amt <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const existing = await prisma.tuitionPayment.findUnique({
      where: {
        studentId_semester_year: {
          studentId: student.id,
          semester: String(semester),
          year: Number(year),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Student has already paid for ${semester} ${year}` },
        { status: 400 }
      );
    }

    const paymentMethodVal = paymentMethod === "electronic" ? "electronic" : "bank_receipt";
    const paymentDateVal = paymentDate ? new Date(paymentDate) : new Date();

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.tuitionPayment.create({
        data: {
          studentId: student.id,
          bankId: bank.id,
          amount: amt,
          semester: String(semester),
          year: Number(year),
          paymentMethod: paymentMethodVal,
          receiptNumber: receiptNumber ? String(receiptNumber).trim() : null,
          transactionId: transactionId ? String(transactionId).trim() : null,
          paymentDate: paymentDateVal,
          recordedById: auth.userId,
          note: note || null,
        },
      });
      const newBalance = Math.max(0, (student.balance ?? 0) - amt);
      await tx.student.update({
        where: { id: student.id },
        data: { balance: newBalance },
      });
      await tx.bank.update({
        where: { id: bank.id },
        data: { balance: { increment: amt } },
      });
      await tx.transactionHistory.create({
        data: {
          type: "deposit",
          amount: amt,
          bankId: bank.id,
          description: `Tuition: ${student.firstName} ${student.lastName} (${student.studentId}) - ${String(semester)} ${year}`,
          studentId: student.id,
          tuitionPaymentId: p.id,
          createdById: auth.userId,
        },
      });
      return tx.tuitionPayment.findUnique({
        where: { id: p.id },
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true, code: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(payment);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Payment already exists for this student/semester/year" },
        { status: 400 }
      );
    }
    console.error("Create tuition payment error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
