import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Verify class exists and matches semester/year
    const cls = await prisma.class.findUnique({
      where: { id: parsedClassId },
      include: {
        course: { select: { code: true, name: true, department: { select: { name: true, code: true, tuitionFee: true } } } },
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

    // Get all students in this class
    const studentsInClass = await prisma.student.findMany({
      where: { classId: parsedClassId, status: "Admitted" },
      include: {
        department: { select: { name: true, code: true, tuitionFee: true } },
        tuitionPayments: {
          where: { semester, year: parsedYear },
          select: { id: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    // Filter to only those who have NOT paid for this semester/year
    const unpaidStudents = studentsInClass
      .filter((s) => s.tuitionPayments.length === 0)
      .map((s) => ({
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        department: s.department,
        tuitionFee: s.department.tuitionFee,
      }));

    return NextResponse.json({
      class: {
        id: cls.id,
        name: cls.name,
        semester: cls.semester,
        year: cls.year,
        course: cls.course,
      },
      semester,
      year: parsedYear,
      unpaidStudents,
      totalUnpaid: unpaidStudents.length,
    });
  } catch (e) {
    console.error("Unpaid students error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
