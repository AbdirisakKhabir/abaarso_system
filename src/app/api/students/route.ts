import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Generate a unique student ID like STD-2026-0001
async function generateStudentId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;

  const lastStudent = await prisma.student.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: "desc" },
  });

  let nextNum = 1;
  if (lastStudent) {
    const lastNum = parseInt(lastStudent.studentId.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const students = await prisma.student.findMany({
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(students);
  } catch (e) {
    console.error("Students list error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
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
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      departmentId,
      imageUrl,
      imagePublicId,
      status,
    } = body;

    const parsedDeptId = Number(departmentId);

    if (!firstName || !lastName || !email || !Number.isInteger(parsedDeptId)) {
      return NextResponse.json(
        { error: "First name, last name, email, and department are required" },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existing = await prisma.student.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A student with this email already exists" },
        { status: 400 }
      );
    }

    const studentId = await generateStudentId();

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email).toLowerCase().trim(),
        phone: phone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        address: address || null,
        departmentId: parsedDeptId,
        imageUrl: imageUrl || null,
        imagePublicId: imagePublicId || null,
        status: status || "Pending",
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(student);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A student with this email already exists" },
        { status: 400 }
      );
    }
    console.error("Create student error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
