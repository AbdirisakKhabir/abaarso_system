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
            class: { select: { id: true, name: true, semester: true, year: true, course: { select: { code: true } } } },
          },
        },
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
    const { studentId: studentIdStr, amount, semester, year, note } = body;

    if (!studentIdStr || !semester || !year) {
      return NextResponse.json(
        { error: "Student ID, semester, and year are required" },
        { status: 400 }
      );
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

    const payment = await prisma.tuitionPayment.create({
      data: {
        studentId: student.id,
        amount: amt,
        semester: String(semester),
        year: Number(year),
        note: note || null,
      },
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
