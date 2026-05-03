import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { perSemesterTuition } from "@/lib/tuition-amount";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const classId = searchParams.get("classId");

    if (!semester || !year || !classId) {
      return NextResponse.json(
        { error: "semester, year, and classId are required" },
        { status: 400 }
      );
    }

    const parsedYear = Number(year);
    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedClassId)) {
      return NextResponse.json(
        { error: "Invalid year or classId" },
        { status: 400 }
      );
    }

    const cls = await prisma.class.findUnique({
      where: { id: parsedClassId },
      include: {
        department: { select: { code: true, name: true, tuitionFee: true } },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    if (cls.semester !== semester || cls.year !== parsedYear) {
      return NextResponse.json(
        { error: "Class semester/year does not match the selected semester and year" },
        { status: 400 }
      );
    }

    const studentsInClass = await prisma.student.findMany({
      where: { classId: parsedClassId, status: "Admitted" },
      include: {
        department: { select: { name: true, code: true, tuitionFee: true } },
        tuitionPayments: {
          where: { semester, year: parsedYear },
          select: { id: true, amount: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    const paidStudents = studentsInClass
      .filter((s) => {
        const paymentStatus = s.paymentStatus ?? "Fully Paid";
        const expectedAmount = perSemesterTuition(
          s.department.tuitionFee ?? 0,
          paymentStatus
        );
        const paidAmount = s.tuitionPayments.reduce((sum, p) => sum + p.amount, 0);
        if (expectedAmount <= 0) return true;
        return paidAmount >= expectedAmount - 1e-6;
      })
      .map((s) => {
        const paymentStatus = s.paymentStatus ?? "Fully Paid";
        const expectedAmount = perSemesterTuition(
          s.department.tuitionFee ?? 0,
          paymentStatus
        );
        const paidAmount = s.tuitionPayments.reduce((sum, p) => sum + p.amount, 0);
        return {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          phone: s.phone,
          department: s.department,
          paymentStatus,
          amountPaid: paidAmount,
          amountExpected: expectedAmount,
        };
      });

    return NextResponse.json({
      class: {
        id: cls.id,
        name: cls.name,
        semester: cls.semester,
        year: cls.year,
        department: cls.department,
      },
      semester,
      year: parsedYear,
      paidStudents,
      totalPaid: paidStudents.length,
    });
  } catch (e) {
    console.error("Paid students error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
