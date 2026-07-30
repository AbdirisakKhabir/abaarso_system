import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isScholarshipStudent,
  perSemesterTuition,
  SCHOLARSHIP_STATUSES,
  type ScholarshipStatus,
} from "@/lib/tuition-amount";
import { parseProgram } from "@/lib/program";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program")) as "Bachelor" | "Masters";
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const classId = searchParams.get("classId");
    const scholarshipType = searchParams.get("scholarshipType") || "all";

    if (!semester || !year || !classId) {
      return NextResponse.json(
        { error: "semester, year, and classId are required" },
        { status: 400 }
      );
    }

    if (
      scholarshipType !== "all" &&
      !(SCHOLARSHIP_STATUSES as readonly string[]).includes(scholarshipType)
    ) {
      return NextResponse.json({ error: "Invalid scholarship type" }, { status: 400 });
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

    if (cls.program !== program) {
      return NextResponse.json(
        { error: "Selected class does not belong to the chosen program" },
        { status: 400 }
      );
    }

    if (cls.semester !== semester || cls.year !== parsedYear) {
      return NextResponse.json(
        { error: "Class semester/year does not match the selected semester and year" },
        { status: 400 }
      );
    }

    const studentsInClass = await prisma.student.findMany({
      where: {
        classId: parsedClassId,
        status: "Admitted",
        program,
        paymentStatus:
          scholarshipType === "all"
            ? { in: [...SCHOLARSHIP_STATUSES] }
            : (scholarshipType as ScholarshipStatus),
      },
      include: {
        department: { select: { name: true, code: true, tuitionFee: true } },
        tuitionPayments: {
          where: { semester, year: parsedYear },
          select: { id: true, amount: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    const scholarshipStudents = studentsInClass
      .filter((s) => isScholarshipStudent(s.paymentStatus ?? "Fully Paid"))
      .map((s) => {
        const paymentStatus = s.paymentStatus ?? "Fully Paid";
        const expectedAmount = perSemesterTuition(
          s.department.tuitionFee ?? 0,
          paymentStatus,
          s.customSemesterFee
        );
        const paidAmount = s.tuitionPayments.reduce((sum, p) => sum + p.amount, 0);
        const amountDue = Math.max(0, expectedAmount - paidAmount);
        const tuitionStatus =
          paymentStatus === "Full Scholarship"
            ? "Exempt"
            : amountDue <= 1e-6
              ? "Paid"
              : paidAmount > 0
                ? "Partial"
                : "Unpaid";

        return {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          phone: s.phone,
          department: s.department,
          paymentStatus,
          amountExpected: expectedAmount,
          amountPaid: paidAmount,
          amountDue,
          tuitionStatus,
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
      scholarshipType,
      scholarshipStudents,
      totalScholarship: scholarshipStudents.length,
    });
  } catch (e) {
    console.error("Scholarship students error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
